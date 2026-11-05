import type { RowDataPacket } from "mysql2";
import { getAuthenticatedUser } from "@/lib/auth";
import { databaseErrorResponse, getDbPool } from "@/lib/db";
import { getProfileImageMimeType, MAX_PROFILE_IMAGE_BYTES } from "@/lib/profile";
import { isSameOriginRequest } from "@/lib/auth-credentials";

type ProfileRow = RowDataPacket & {
  username: string;
  email: string;
  has_profile_picture: number;
};

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const [rows] = await getDbPool().execute<ProfileRow[]>(
      `SELECT username, email, profile_picture IS NOT NULL AS has_profile_picture
       FROM users WHERE id = ?`,
      [user.id],
    );
    const profile = rows[0];
    if (!profile) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }
    return Response.json(
      {
        username: profile.username,
        email: profile.email,
        avatarUrl: profile.has_profile_picture ? "/api/profile/avatar" : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ error: "Request must contain a valid profile image." }, { status: 400 });
    }
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Choose an image to upload." }, { status: 400 });
    }
    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      return Response.json({ error: "Profile images must be 2 MB or smaller." }, { status: 413 });
    }

    const image = new Uint8Array(await file.arrayBuffer());
    const mimeType = getProfileImageMimeType(image);
    if (!mimeType || file.type !== mimeType) {
      return Response.json(
        { error: "Upload a valid PNG, JPEG, or WebP image." },
        { status: 400 },
      );
    }

    await getDbPool().execute(
      "UPDATE users SET profile_picture = ?, profile_picture_mime = ? WHERE id = ?",
      [Buffer.from(image), mimeType, user.id],
    );
    return Response.json({ avatarUrl: "/api/profile/avatar" });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    await getDbPool().execute(
      "UPDATE users SET profile_picture = NULL, profile_picture_mime = NULL WHERE id = ?",
      [user.id],
    );
    return Response.json({ avatarUrl: null });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
