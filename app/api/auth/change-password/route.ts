import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { getAuthenticatedUser } from "@/lib/auth";
import { databaseErrorResponse, getDbPool } from "@/lib/db";
import {
  clearedSessionCookie,
  hashPassword,
  isSameOriginRequest,
  isValidPassword,
  verifyPassword,
} from "@/lib/auth-credentials";
import { isRecord } from "@/lib/validation";

type PasswordRow = RowDataPacket & { password_hash: string };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  let user: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  try {
    user = await getAuthenticatedUser(request);
  } catch (error) {
    return databaseErrorResponse(error);
  }
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const currentPassword =
    isRecord(body) && isValidPassword(body.currentPassword) ? body.currentPassword : null;
  const newPassword =
    isRecord(body) && isValidPassword(body.newPassword) ? body.newPassword : null;
  if (!currentPassword || !newPassword) {
    return Response.json(
      { error: "Enter your current password and a new password of 8-128 characters." },
      { status: 400 },
    );
  }

  let connection: PoolConnection | undefined;
  try {
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<PasswordRow[]>(
      "SELECT password_hash FROM users WHERE id = ? FOR UPDATE",
      [user.id],
    );
    const account = rows[0];
    if (!account || !(await verifyPassword(currentPassword, account.password_hash))) {
      await connection.rollback();
      return Response.json({ error: "Your current password is incorrect." }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await connection.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      user.id,
    ]);
    await connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", [user.id]);
    await connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [user.id]);
    await connection.commit();
    return Response.json(
      { message: "Password changed. Sign in again with your new password." },
      { headers: { "Set-Cookie": clearedSessionCookie() } },
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return databaseErrorResponse(error);
  } finally {
    connection?.release();
  }
}
