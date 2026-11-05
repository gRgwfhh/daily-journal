import type { RowDataPacket } from "mysql2";
import { getAuthenticatedUser } from "@/lib/auth";
import { databaseErrorResponse, getDbPool } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/auth-credentials";

type AvatarRow = RowDataPacket & {
  profile_picture: Buffer | null;
  profile_picture_mime: string | null;
};

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const [rows] = await getDbPool().execute<AvatarRow[]>(
      "SELECT profile_picture, profile_picture_mime FROM users WHERE id = ?",
      [user.id],
    );
    const avatar = rows[0];
    if (!avatar?.profile_picture || !avatar.profile_picture_mime) {
      return Response.json({ error: "No profile picture is set." }, { status: 404 });
    }
    return new Response(new Uint8Array(avatar.profile_picture), {
      headers: {
        "Content-Type": avatar.profile_picture_mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
