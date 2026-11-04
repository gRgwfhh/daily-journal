import { getDbPool, databaseErrorResponse } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { isRecord, isValidDate, isValidSleepHours } from "@/lib/validation";
import type { RowDataPacket } from "mysql2";

type SleepRow = RowDataPacket & {
  sleep_date: string;
  hours_slept: number;
};

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month");
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ error: "A valid month in YYYY-MM format is required." }, { status: 400 });
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const [rows] = await getDbPool().execute<SleepRow[]>(
      `SELECT sleep_date, hours_slept
       FROM sleep_records
       WHERE user_id = ? AND sleep_date >= ? AND sleep_date < ?
       ORDER BY sleep_date`,
      [user.id, start, end],
    );
    return Response.json(
      rows.map((row) => {
        return {
          date: row.sleep_date,
          hoursSlept: Number(row.hours_slept),
        };
      }),
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
    !isValidSleepHours(body.hoursSlept)
  ) {
    return Response.json(
      { error: "Provide a valid date and hoursSlept value from 0 to 12 with at most two decimal places." },
      { status: 400 },
    );
  }

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    await getDbPool().execute(
      `INSERT INTO sleep_records (user_id, sleep_date, hours_slept) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE hours_slept = VALUES(hours_slept)`,
      [user.id, body.date, body.hoursSlept],
    );
    return Response.json({
      date: body.date,
      hoursSlept: body.hoursSlept,
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
