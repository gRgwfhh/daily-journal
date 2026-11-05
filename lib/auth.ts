import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import {
  getSessionToken,
  hashSessionToken,
  isSameOriginRequest,
} from "@/lib/auth-credentials";

const SESSION_COOKIE_NAME = "daily_journal_session";

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  has_profile_picture: number;
};

async function findUserForToken(token: string | null | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }
  const [rows] = await getDbPool().execute<UserRow[]>(
    `SELECT users.id, users.username,
            users.profile_picture IS NOT NULL AS has_profile_picture
     FROM auth_sessions
     INNER JOIN users ON users.id = auth_sessions.user_id
     WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > CURRENT_TIMESTAMP`,
    [hashSessionToken(token)],
  );
  return rows[0] ?? null;
}

export async function getAuthenticatedUser(request: Request) {
  if (!isSameOriginRequest(request)) {
    return null;
  }
  const token = getSessionToken(request.headers.get("cookie"));
  return findUserForToken(token);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const user = await findUserForToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  return user
    ? {
        id: user.id,
        username: user.username,
        avatarUrl: user.has_profile_picture ? "/api/profile/avatar" : null,
      }
    : null;
}
