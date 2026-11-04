import mysql, { type Pool } from "mysql2/promise";

declare global {
  var dailyJournalPool: Pool | undefined;
}

export function getDbPool() {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } =
    process.env;

  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) {
    throw new Error(
      "Database configuration is incomplete. Set MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE.",
    );
  }

  if (globalThis.dailyJournalPool) {
    return globalThis.dailyJournalPool;
  }

  const pool = mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT || 3306),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD ?? "",
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z",
    dateStrings: true,
  });

  globalThis.dailyJournalPool = pool;
  return pool;
}

export function isDatabaseConfigurationError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.startsWith("Database configuration is incomplete.")
  );
}

export function databaseErrorResponse(error: unknown) {
  if (isDatabaseConfigurationError(error)) {
    return Response.json({ error: error.message }, { status: 503 });
  }

  console.error("MySQL request failed:", error);
  return Response.json(
    { error: "The database request could not be completed." },
    { status: 500 },
  );
}
