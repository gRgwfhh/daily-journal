export type JournalPeriod = "day" | "week" | "month" | "year" | "all";

export type JournalDateRange = {
  start: string;
  end: string;
};

export type JournalQuery = {
  sql: string;
  values: (number | string)[];
};

export function isJournalPeriod(value: string): value is JournalPeriod {
  return (
    value === "day" ||
    value === "week" ||
    value === "month" ||
    value === "year" ||
    value === "all"
  );
}

export function getJournalReadQuery(
  userId: number,
  range?: JournalDateRange,
): JournalQuery {
  if (!range) {
    return {
      sql: "SELECT moment_date, moment, updated_at FROM memorable_moments WHERE user_id = ? ORDER BY moment_date DESC",
      values: [userId],
    };
  }

  return {
    sql: `SELECT moment_date, moment, updated_at FROM memorable_moments
         WHERE user_id = ? AND moment_date >= ? AND moment_date < ?
         ORDER BY moment_date DESC`,
    values: [userId, range.start, range.end],
  };
}

export function getJournalUpsertQuery(
  userId: number,
  date: string,
  text: string,
): JournalQuery {
  return {
    sql: `INSERT INTO memorable_moments (user_id, moment_date, moment) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE moment = VALUES(moment)`,
    values: [userId, date, text],
  };
}

export function getJournalDeleteQuery(userId: number, date: string): JournalQuery {
  return {
    sql: "DELETE FROM memorable_moments WHERE moment_date = ? AND user_id = ?",
    values: [date, userId],
  };
}
