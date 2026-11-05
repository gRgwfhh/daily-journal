import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { getMailConfiguration, sendPasswordResetEmail } from "@/lib/email";
import { databaseErrorResponse, getDbPool } from "@/lib/db";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isSameOriginRequest,
  normalizeEmail,
  PASSWORD_RESET_COOLDOWN_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
} from "@/lib/auth-credentials";
import { isRecord } from "@/lib/validation";

type UserRow = RowDataPacket & { id: number; email: string };
type ResetTokenRow = RowDataPacket & { token_hash: string };
const GENERIC_RESPONSE = {
  message:
    "If an account exists for that email, check your inbox for reset instructions. If no email arrives, try again later.",
};

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

  const email = isRecord(body) ? normalizeEmail(body.email) : null;
  if (!email) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    getMailConfiguration();
  } catch (error) {
    console.error("Password reset email configuration failed:", error);
    return Response.json(
      { error: "Password recovery is not available right now." },
      { status: 503 },
    );
  }

  let connection: PoolConnection | undefined;
  let resetRequest: { email: string; token: string; tokenHash: string } | null = null;
  try {
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<UserRow[]>(
      "SELECT id, email FROM users WHERE email = ? FOR UPDATE",
      [email],
    );
    const user = rows[0];
    if (!user) {
      await connection.commit();
      return Response.json(GENERIC_RESPONSE);
    }

    const [recentTokens] = await connection.execute<ResetTokenRow[]>(
      `SELECT token_hash FROM password_reset_tokens
       WHERE user_id = ? AND expires_at > DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
       LIMIT 1`,
      [user.id, PASSWORD_RESET_TOKEN_TTL_SECONDS - PASSWORD_RESET_COOLDOWN_SECONDS],
    );
    if (recentTokens.length > 0) {
      await connection.commit();
      return Response.json(GENERIC_RESPONSE);
    }

    const token = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    await connection.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", [
      user.id,
    ]);
    await connection.execute(
      `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))`,
      [tokenHash, user.id, PASSWORD_RESET_TOKEN_TTL_SECONDS],
    );
    await connection.commit();
    resetRequest = { email: user.email, token, tokenHash };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return databaseErrorResponse(error);
  } finally {
    connection?.release();
  }

  if (!resetRequest) {
    return Response.json(GENERIC_RESPONSE);
  }

  try {
    await sendPasswordResetEmail(resetRequest.email, resetRequest.token);
  } catch (error) {
    console.error("Password reset email delivery failed:", error);
    try {
      await getDbPool().execute(
        "DELETE FROM password_reset_tokens WHERE token_hash = ?",
        [resetRequest.tokenHash],
      );
    } catch (cleanupError) {
      console.error("Could not remove an unsent password reset token:", cleanupError);
    }
    return Response.json(GENERIC_RESPONSE);
  }

  return Response.json(GENERIC_RESPONSE);
}
