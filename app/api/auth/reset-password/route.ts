import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { databaseErrorResponse, getDbPool } from "@/lib/db";
import {
  clearedSessionCookie,
  hashPassword,
  hashPasswordResetToken,
  isSameOriginRequest,
  isValidPassword,
} from "@/lib/auth-credentials";
import { isRecord } from "@/lib/validation";

type ResetRow = RowDataPacket & { user_id: number };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const token =
    isRecord(body) && typeof body.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(body.token)
      ? body.token
      : null;
  const password =
    isRecord(body) && isValidPassword(body.password) ? body.password : null;
  if (!token || !password) {
    return Response.json(
      { error: "Use a valid reset link and choose a password of 8-128 characters." },
      { status: 400 },
    );
  }

  let connection: PoolConnection | undefined;
  try {
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<ResetRow[]>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() FOR UPDATE`,
      [hashPasswordResetToken(token)],
    );
    const reset = rows[0];
    if (!reset) {
      await connection.rollback();
      return Response.json(
        { error: "This password reset link is invalid or has expired. Request a new one." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    await connection.execute("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      reset.user_id,
    ]);
    await connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [
      reset.user_id,
    ]);
    await connection.execute("DELETE FROM auth_sessions WHERE user_id = ?", [reset.user_id]);
    await connection.commit();
    return Response.json(
      { message: "Password reset. Sign in with your new password." },
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
