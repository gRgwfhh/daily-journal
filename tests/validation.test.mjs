import assert from "node:assert/strict";
import test from "node:test";
import {
  getPeriodRange,
  isValidDate,
  isValidSleepHours,
} from "../lib/validation.ts";
import {
  createSessionToken,
  getSessionToken,
  hashPassword,
  hashSessionToken,
  isSameOriginRequest,
  isValidPassword,
  normalizeEmail,
  normalizeUsername,
  verifyPassword,
} from "../lib/auth-credentials.ts";
import {
  getSleepChartPoint,
  getSleepLineSegments,
} from "../lib/sleep-chart.ts";

test("validates real calendar dates", () => {
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2025-02-29"), false);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(isValidDate("2026-1-01"), false);
});

test("returns the selected day range", () => {
  assert.deepEqual(getPeriodRange("day", "2024-02-29"), {
    start: "2024-02-29",
    end: "2024-03-01",
  });
});

test("validates sleep hours from 0 through 12 to two decimal places", () => {
  assert.equal(isValidSleepHours(0), true);
  assert.equal(isValidSleepHours(7.5), true);
  assert.equal(isValidSleepHours(7.15), true);
  assert.equal(isValidSleepHours(12), true);
  assert.equal(isValidSleepHours(-0.01), false);
  assert.equal(isValidSleepHours(12.01), false);
  assert.equal(isValidSleepHours(7.123), false);
  assert.equal(isValidSleepHours("7.5"), false);
  assert.equal(isValidSleepHours(Number.NaN), false);
});

test("colors sleep line segments red at or below 4 hours and blue above", () => {
  const records = [
    { date: "2026-11-01", hoursSlept: 3 },
    { date: "2026-11-02", hoursSlept: 4 },
    { date: "2026-11-03", hoursSlept: 6 },
  ];

  assert.deepEqual(getSleepLineSegments(records, 30), [
    { color: "red", d: "M 40 158 L 71.72413793103448 144" },
    { color: "blue", d: "M 71.72413793103448 144 L 103.44827586206897 116" },
  ]);
});

test("splits a crossing segment at four hours and leaves gaps between dates", () => {
  const records = [
    { date: "2026-11-01", hoursSlept: 2 },
    { date: "2026-11-02", hoursSlept: 6 },
    { date: "2026-11-04", hoursSlept: 8 },
    { date: "2026-11-05", hoursSlept: 3 },
  ];

  const segments = getSleepLineSegments(records, 30);
  assert.equal(segments.length, 4);
  assert.equal(segments[0].color, "red");
  assert.equal(segments[1].color, "blue");
  assert.equal(segments[0].d.endsWith("L 55.86206896551724 144"), true);
  assert.equal(segments[1].d.startsWith("M 55.86206896551724 144"), true);
  assert.equal(segments[2].color, "blue");
  assert.equal(segments[2].d.includes(" 144"), true);
  assert.equal(segments[3].color, "red");
  assert.equal(segments[3].d.includes(" 144"), true);
  assert.deepEqual(getSleepChartPoint(records[0], 30), { x: 40, y: 172 });
});

test("returns Monday-based week boundaries", () => {
  assert.deepEqual(getPeriodRange("week", "2026-03-04"), {
    start: "2026-03-02",
    end: "2026-03-09",
  });
});

test("handles month and year boundaries", () => {
  assert.deepEqual(getPeriodRange("month", "2026-12-15"), {
    start: "2026-12-01",
    end: "2027-01-01",
  });
  assert.deepEqual(getPeriodRange("year", "2024-02-29"), {
    start: "2024-01-01",
    end: "2025-01-01",
  });
});

test("normalizes usernames and email addresses and rejects invalid values", () => {
  assert.equal(normalizeUsername("  Journal_User-1 "), "journal_user-1");
  assert.equal(normalizeUsername("ab"), null);
  assert.equal(normalizeUsername("has space"), null);
  assert.equal(normalizeEmail("  Person@Example.com "), "person@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail("a".repeat(250) + "@example.com"), null);
});

test("requires a bounded password length", () => {
  assert.equal(isValidPassword("long-enough-password"), true);
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("p".repeat(129)), false);
  assert.equal(isValidPassword(null), false);
});

test("hashes passwords with a unique salt and verifies only the matching password", async () => {
  const firstHash = await hashPassword("correct horse battery staple");
  const secondHash = await hashPassword("correct horse battery staple");
  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword("correct horse battery staple", firstHash), true);
  assert.equal(await verifyPassword("different password", firstHash), false);
  assert.equal(await verifyPassword("password", "invalid-hash"), false);
});

test("creates opaque session tokens and accepts only valid session cookies", () => {
  const token = createSessionToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(getSessionToken(`other=value; daily_journal_session=${token}`), token);
  assert.equal(getSessionToken("daily_journal_session=bad-token"), null);
  assert.equal(getSessionToken(null), null);
  assert.match(hashSessionToken(token), /^[a-f0-9]{64}$/);
  assert.notEqual(hashSessionToken(token), token);
});

test("rejects cross-origin requests that could mutate an account", () => {
  assert.equal(isSameOriginRequest(new Request("http://localhost:3000/api/hobbies", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  })), true);
  assert.equal(isSameOriginRequest(new Request("http://localhost:3000/api/hobbies", {
    method: "POST",
    headers: { origin: "https://attacker.example" },
  })), false);
  assert.equal(isSameOriginRequest(new Request("http://localhost:3000/api/hobbies", {
    method: "POST",
  })), true);
});
