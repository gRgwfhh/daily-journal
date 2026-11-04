import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { getDbPool, databaseErrorResponse } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isValidPassword,
  isSameOriginRequest,
  normalizeEmail,
  normalizeUsername,
  sessionCookie,
} from "@/lib/auth-credentials";
import { isRecord } from "@/lib/validation";

function duplicateAccountError(error: unknown) {
  return isRecord(error) && error.code === "ER_DUP_ENTRY";
}

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

  const username = isRecord(body) ? normalizeUsername(body.username) : null;
  const email = isRecord(body) ? normalizeEmail(body.email) : null;
  const password = isRecord(body) && isValidPassword(body.password) ? body.password : null;
  if (!username || !email || !password) {
    return Response.json(
      {
        error:
          "Provide a username (3-32 letters, numbers, underscores, or hyphens), a valid email, and a password of 8-128 characters.",
      },
      { status: 400 },
    );
  }

  let connection: PoolConnection | undefined;
  try {
    const passwordHash = await hashPassword(password);
    const token = createSessionToken();
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, passwordHash],
    );
    await connection.execute(
      "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY))",
      [hashSessionToken(token), result.insertId],
    );
    await connection.commit();
    return Response.json(
      { username },
      { status: 201, headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    if (duplicateAccountError(error)) {
      return Response.json({ error: "That username or email is already registered." }, { status: 409 });
    }
    return databaseErrorResponse(error);
  } finally {
    connection?.release();
  }
}
