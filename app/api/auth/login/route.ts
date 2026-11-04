import type { RowDataPacket } from "mysql2";
import { getDbPool, databaseErrorResponse } from "@/lib/db";
import { isRecord } from "@/lib/validation";
import {
  createSessionToken,
  hashSessionToken,
  isValidPassword,
  isSameOriginRequest,
  normalizeUsername,
  sessionCookie,
  verifyPassword,
} from "@/lib/auth-credentials";

type LoginRow = RowDataPacket & {
  id: number;
  password_hash: string;
};

const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

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
  const password = isRecord(body) && isValidPassword(body.password) ? body.password : null;
  if (!username || !password) {
    return Response.json({ error: "Username or password is incorrect." }, { status: 401 });
  }

  try {
    const [rows] = await getDbPool().execute<LoginRow[]>(
      "SELECT id, password_hash FROM users WHERE username = ?",
      [username],
    );
    const user = rows[0];
    const passwordMatches = await verifyPassword(
      password,
      user?.password_hash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordMatches) {
      return Response.json({ error: "Username or password is incorrect." }, { status: 401 });
    }

    const token = createSessionToken();
    await getDbPool().execute(
      "INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY))",
      [hashSessionToken(token), user.id],
    );
    return Response.json(
      { username },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
