export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getHobbyCheckinDate(chartDate: string, summaryDate: string) {
  return chartDate || summaryDate;
}

export function getPeriodRange(period: string, referenceDate: string) {
  const [year, month, day] = referenceDate.split("-").map(Number);
  let start: Date;
  let end: Date;

  if (period === "day") {
    start = new Date(Date.UTC(year, month - 1, day));
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (period === "month") {
    start = new Date(Date.UTC(year, month - 1, 1));
    end = new Date(Date.UTC(year, month, 1));
  } else if (period === "year") {
    start = new Date(Date.UTC(year, 0, 1));
    end = new Date(Date.UTC(year + 1, 0, 1));
  } else {
    start = new Date(Date.UTC(year, month - 1, day));
    const daysSinceMonday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidSleepHours(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 12 &&
    Number(value.toFixed(2)) === value
  );
}
