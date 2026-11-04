import { getDbPool, databaseErrorResponse } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { isRecord, isValidDate } from "@/lib/validation";
import type { ResultSetHeader } from "mysql2";

type Context = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: Context) {
  const { id: idValue } = await context.params;
  const id = parseId(idValue);
  if (!id) {
    return Response.json({ error: "Invalid hobby ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    typeof body.checked !== "boolean" ||
    !isValidDate(body.date)
  ) {
    return Response.json({ error: "A checked value and valid date are required." }, { status: 400 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const pool = getDbPool();
    const [hobbies] = await pool.execute(
      "SELECT id FROM hobbies WHERE id = ? AND user_id = ?",
      [id, user.id],
    );
    if (!Array.isArray(hobbies) || hobbies.length === 0) {
      return Response.json({ error: "Hobby not found." }, { status: 404 });
    }

    if (body.checked) {
      await pool.execute(
        "INSERT IGNORE INTO hobby_checkins (hobby_id, check_date) VALUES (?, ?)",
        [id, body.date],
      );
    } else {
      await pool.execute(
        "DELETE FROM hobby_checkins WHERE hobby_id = ? AND check_date = ?",
        [id, body.date],
      );
    }
    return Response.json({ id, checked: body.checked, date: body.date });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id: idValue } = await context.params;
  const id = parseId(idValue);
  if (!id) {
    return Response.json({ error: "Invalid hobby ID." }, { status: 400 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const [result] = await getDbPool().execute<ResultSetHeader>(
      "DELETE FROM hobbies WHERE id = ? AND user_id = ?",
      [id, user.id],
    );
    if (result.affectedRows === 0) {
      return Response.json({ error: "Hobby not found." }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
