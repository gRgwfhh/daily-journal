import { getDbPool, databaseErrorResponse } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { isRecord, isValidDate } from "@/lib/validation";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

type HobbyIdRow = RowDataPacket & { id: number };
type LegacyHobby = {
  name: string;
  checkCount: number;
  checked: boolean;
  lastChecked?: string;
  createdAt?: string;
};
type LegacyMoment = { date: string; text: string };

function isLegacyHobby(value: unknown): value is LegacyHobby {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.trim().length <= 255 &&
    typeof value.checkCount === "number" &&
    Number.isSafeInteger(value.checkCount) &&
    value.checkCount >= 0 &&
    typeof value.checked === "boolean"
  );
}

function isLegacyMoment(value: unknown): value is LegacyMoment {
  return (
    isRecord(value) &&
    isValidDate(value.date) &&
    typeof value.text === "string" &&
    value.text.trim().length > 0 &&
    value.text.trim().length <= 10000
  );
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
    !Array.isArray(body.hobbies) ||
    !Array.isArray(body.journalEntries)
  ) {
    return Response.json({ error: "Hobbies and journalEntries arrays are required." }, { status: 400 });
  }

  const hobbies = body.hobbies.filter(isLegacyHobby);
  const journalEntries = body.journalEntries.filter(isLegacyMoment);

  if (hobbies.length !== body.hobbies.length || journalEntries.length !== body.journalEntries.length) {
    return Response.json({ error: "Local data contains invalid hobby or journal entries." }, { status: 400 });
  }

  let connection: PoolConnection | undefined;
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    connection = await getDbPool().getConnection();
    await connection.beginTransaction();

    for (const hobby of hobbies) {
      const name = hobby.name.trim();
      await connection.execute(
        `INSERT INTO hobbies (user_id, name, legacy_check_count) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE legacy_check_count = GREATEST(legacy_check_count, VALUES(legacy_check_count))`,
        [user.id, name, hobby.checkCount],
      );
      const [rows] = await connection.execute<HobbyIdRow[]>(
        "SELECT id FROM hobbies WHERE user_id = ? AND name = ?",
        [user.id, name],
      );
      const hobbyId = rows[0]?.id;
      if (hobby.checked && hobbyId) {
        const lastCheckedDate = hobby.lastChecked?.slice(0, 10);
        const createdDate = hobby.createdAt?.slice(0, 10);
        const checkedDate = isValidDate(lastCheckedDate)
          ? lastCheckedDate
          : isValidDate(createdDate)
            ? createdDate
            : new Date().toISOString().slice(0, 10);
        await connection.execute(
          "INSERT IGNORE INTO hobby_checkins (hobby_id, check_date) VALUES (?, ?)",
          [hobbyId, checkedDate],
        );
      }
    }

    for (const entry of journalEntries) {
      await connection.execute(
        "INSERT IGNORE INTO memorable_moments (user_id, moment_date, moment) VALUES (?, ?, ?)",
        [user.id, entry.date, entry.text.trim()],
      );
    }

    await connection.commit();
    return Response.json({
      importedHobbies: hobbies.length,
      importedJournalEntries: journalEntries.length,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return databaseErrorResponse(error);
  } finally {
    connection?.release();
  }
}
