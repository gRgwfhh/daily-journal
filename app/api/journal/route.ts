import { getDbPool, databaseErrorResponse } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPeriodRange, isRecord, isValidDate } from "@/lib/validation";
import type { RowDataPacket } from "mysql2";

type JournalRow = RowDataPacket & {
  moment_date: string;
  moment: string;
  updated_at: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "all";
  const date = searchParams.get("date");

  if (!["day", "week", "month", "year", "all"].includes(period)) {
    return Response.json({ error: "Unsupported journal period." }, { status: 400 });
  }
  if (period !== "all" && !isValidDate(date)) {
    return Response.json({ error: "A valid date is required for this period." }, { status: 400 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    let rows: JournalRow[];
    if (period === "all") {
      [rows] = await getDbPool().execute<JournalRow[]>(
        "SELECT moment_date, moment, updated_at FROM memorable_moments WHERE user_id = ? ORDER BY moment_date DESC",
        [user.id],
      );
    } else {
      const { start, end } = getPeriodRange(period, date!);
      [rows] = await getDbPool().execute<JournalRow[]>(
        `SELECT moment_date, moment, updated_at FROM memorable_moments
         WHERE user_id = ? AND moment_date >= ? AND moment_date < ?
         ORDER BY moment_date DESC`,
        [user.id, start, end],
      );
    }
    return Response.json(
      rows.map((row) => ({
        date: row.moment_date,
        text: row.moment,
        updatedAt: row.updated_at,
      })),
    );
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    !isValidDate(body.date) ||
    typeof body.text !== "string" ||
    !body.text.trim() ||
    body.text.trim().length > 10000
  ) {
    return Response.json(
      { error: "A valid date and moment of 1 to 10,000 characters are required." },
      { status: 400 },
    );
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    await getDbPool().execute(
      `INSERT INTO memorable_moments (user_id, moment_date, moment) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE moment = VALUES(moment)`,
      [user.id, body.date, body.text.trim()],
    );
    return Response.json({ date: body.date, text: body.text.trim() });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!isValidDate(date)) {
    return Response.json({ error: "A valid date is required." }, { status: 400 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const [result] = await getDbPool().execute(
      "DELETE FROM memorable_moments WHERE moment_date = ? AND user_id = ?",
      [date, user.id],
    );
    const header = result as { affectedRows?: number };
    if (!header.affectedRows) {
      return Response.json({ error: "Journal entry not found." }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
