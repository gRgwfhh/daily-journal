import { getDbPool, databaseErrorResponse } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { isRecord, isValidDate } from "@/lib/validation";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

type HobbyRow = RowDataPacket & {
  id: number;
  name: string;
  created_at: string;
  legacy_check_count: number;
  checked: number;
  range_count: number;
  total_count: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedDate = searchParams.get("date");
  const period = searchParams.get("period") ?? "week";
  const referenceDate = searchParams.get("referenceDate") ?? selectedDate;

  if (!isValidDate(selectedDate) || !isValidDate(referenceDate)) {
    return Response.json({ error: "A valid date and referenceDate are required." }, { status: 400 });
  }
  if (!["day", "week", "month", "year"].includes(period)) {
    return Response.json({ error: "Unsupported hobby check-in period." }, { status: 400 });
  }

  const [year, month, day] = referenceDate.split("-").map(Number);
  let start: string;
  let end: string;
  if (period === "day") {
    start = referenceDate;
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    end = next.toISOString().slice(0, 10);
  } else if (period === "month") {
    start = `${referenceDate.slice(0, 7)}-01`;
    end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  } else if (period === "year") {
    start = `${year}-01-01`;
    end = `${year + 1}-01-01`;
  } else {
    const weekStart = new Date(Date.UTC(year, month - 1, day));
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    start = weekStart.toISOString().slice(0, 10);
    weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    end = weekStart.toISOString().slice(0, 10);
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const [rows] = await getDbPool().execute<HobbyRow[]>(
      `SELECT h.id, h.name, h.created_at, h.legacy_check_count,
        EXISTS(
          SELECT 1 FROM hobby_checkins checked_in
          WHERE checked_in.hobby_id = h.id AND checked_in.check_date = ?
        ) AS checked,
        (
          SELECT COUNT(*) FROM hobby_checkins period_check
          WHERE period_check.hobby_id = h.id
            AND period_check.check_date >= ? AND period_check.check_date < ?
        ) AS range_count,
        h.legacy_check_count + (
          SELECT COUNT(*) FROM hobby_checkins all_check
          WHERE all_check.hobby_id = h.id
        ) AS total_count
      FROM hobbies h
      WHERE h.user_id = ?
      ORDER BY h.created_at DESC, h.id DESC`,
      [selectedDate, start, end, user.id],
    );

    return Response.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
        checked: Boolean(row.checked),
        checkCount: Number(row.range_count),
        allTimeCount: Number(row.total_count),
        lastChecked: undefined,
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

  const name = isRecord(body) && typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 255) {
    return Response.json({ error: "Hobby name must be between 1 and 255 characters." }, { status: 400 });
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const [result] = await getDbPool().execute<ResultSetHeader>(
      "INSERT INTO hobbies (user_id, name) VALUES (?, ?)",
      [user.id, name],
    );
    return Response.json({ id: result.insertId, name }, { status: 201 });
  } catch (error) {
    if (isRecord(error) && error.code === "ER_DUP_ENTRY") {
      return Response.json({ error: "A hobby with that name already exists." }, { status: 409 });
    }
    return databaseErrorResponse(error);
  }
}
