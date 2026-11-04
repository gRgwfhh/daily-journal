import { getAuthenticatedUser } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/db";
import {
  clearedSessionCookie,
  getSessionToken,
  hashSessionToken,
  isSameOriginRequest,
} from "@/lib/auth-credentials";
import { getDbPool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    return Response.json({ username: user.username });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const token = getSessionToken(request.headers.get("cookie"));
    if (token) {
      await getDbPool().execute(
        "DELETE FROM auth_sessions WHERE token_hash = ?",
        [hashSessionToken(token)],
      );
    }
    return Response.json(
      { success: true },
      { headers: { "Set-Cookie": clearedSessionCookie() } },
    );
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
