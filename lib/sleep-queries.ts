export function getSleepDeleteQuery(userId: number, date: string) {
  return {
    sql: "DELETE FROM sleep_records WHERE user_id = ? AND sleep_date = ?",
    values: [userId, date],
  };
}
