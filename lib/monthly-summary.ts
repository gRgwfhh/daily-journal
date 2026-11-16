type SleepRecord = {
  hoursSlept: number;
};

type JournalEntryDate = {
  date: string;
};

export function getSleepSummary(records: SleepRecord[]) {
  if (records.length === 0) {
    return null;
  }

  const total = records.reduce((sum, record) => sum + record.hoursSlept, 0);
  const hours = records.map((record) => record.hoursSlept);

  return {
    average: total / records.length,
    lowest: Math.min(...hours),
    highest: Math.max(...hours),
  };
}

export function getMonthlyJournalSummary(
  entries: JournalEntryDate[],
  month: string,
  today: string,
) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const monthEntries = entries.filter(({ date }) => date >= monthStart && date <= monthEnd);
  const lastMissedDate = today < monthStart ? "" : today > monthEnd ? monthEnd : today;
  const elapsedDays = lastMissedDate ? Number(lastMissedDate.slice(-2)) : 0;
  const enteredDays = new Set(
    monthEntries
      .filter(({ date }) => date <= lastMissedDate)
      .map(({ date }) => date),
  );

  return {
    entryCount: monthEntries.length,
    missedDateCount: elapsedDays - enteredDays.size,
  };
}
