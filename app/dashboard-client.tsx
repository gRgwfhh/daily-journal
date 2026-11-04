"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { getSleepChartPoint, getSleepLineSegments } from "@/lib/sleep-chart";

type Hobby = {
  id: number;
  name: string;
  createdAt: string;
  checked: boolean;
  checkCount: number;
  allTimeCount: number;
};

type JournalEntry = {
  date: string;
  text: string;
  updatedAt: string;
};

type SleepRecord = {
  date: string;
  hoursSlept: number;
};

const HOBBY_COLORS = ["#2563eb", "#db2777", "#d97706", "#059669", "#7c3aed", "#0891b2"];

async function requestApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }
    return undefined as T;
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(`The server returned an invalid response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "The request could not be completed.";
    throw new Error(message);
  }

  return result as T;
}

function buildChartGradient(items: { checks: number; color: string }[]) {
  const total = items.reduce((sum, item) => sum + item.checks, 0);

  if (total === 0) {
    return "#e2e8f0 0% 100%";
  }

  let start = 0;
  return items
    .map((item) => {
      const end = start + (item.checks / total) * 100;
      const segment = `${item.color} ${start}% ${end}%`;
      start = end;
      return segment;
    })
    .join(", ");
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "Not checked";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not checked";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getServerDateSnapshot() {
  return "";
}

function subscribeToNoChanges() {
  return () => {};
}

function formatJournalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(
    new Date(year, month - 1, day),
  );
}

function isInJournalPeriod(entryDate: string, period: string, referenceDate: string) {
  if (period === "all") {
    return true;
  }
  if (period === "day") {
    return entryDate === referenceDate;
  }
  if (period === "month") {
    return entryDate.slice(0, 7) === referenceDate.slice(0, 7);
  }
  if (period === "year") {
    return entryDate.slice(0, 4) === referenceDate.slice(0, 4);
  }

  const [year, month, day] = referenceDate.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const [entryYear, entryMonth, entryDay] = entryDate.split("-").map(Number);
  const date = new Date(entryYear, entryMonth - 1, entryDay);
  return date >= start && date < end;
}

export default function Home({ username }: { username: string }) {
  const router = useRouter();
  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [newHobby, setNewHobby] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSummaryDate, setSelectedSummaryDate] = useState("");
  const [hobbyPeriod, setHobbyPeriod] = useState("week");
  const [hobbyChartDate, setHobbyChartDate] = useState("");
  const [hobbyStatus, setHobbyStatus] = useState("");
  const [hobbyRefresh, setHobbyRefresh] = useState(0);
  const [selectedJournalDate, setSelectedJournalDate] = useState("");
  const [selectedJournalReferenceDate, setSelectedJournalReferenceDate] = useState("");
  const [journalPeriod, setJournalPeriod] = useState("week");
  const [journalDraft, setJournalDraft] = useState("");
  const [journalDraftDate, setJournalDraftDate] = useState("");
  const [journalStatus, setJournalStatus] = useState("");
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalRefresh, setJournalRefresh] = useState(0);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [summarySleepRecord, setSummarySleepRecord] = useState<SleepRecord | null>(null);
  const [summarySleepStatus, setSummarySleepStatus] = useState("");
  const [sleepDateSelection, setSleepDateSelection] = useState("");
  const [hoursSlept, setHoursSlept] = useState("");
  const [sleepStatus, setSleepStatus] = useState("");
  const [sleepRefresh, setSleepRefresh] = useState(0);
  const todayDate = useSyncExternalStore(
    subscribeToNoChanges,
    () => getLocalDateValue(),
    getServerDateSnapshot,
  );

  const summaryDate = selectedSummaryDate || todayDate;
  const journalDate = selectedJournalDate || todayDate;
  const journalReferenceDate = selectedJournalReferenceDate || summaryDate;
  const sleepDate = sleepDateSelection || todayDate;
  const sleepMonth = sleepDate.slice(0, 7);

  useEffect(() => {
    if (!todayDate) {
      return;
    }

    let active = true;
    const loadHobbies = async () => {
      const selectedDate = summaryDate || todayDate;
      const chartReferenceDate = hobbyChartDate || selectedDate;
      const query = new URLSearchParams({
        date: selectedDate,
        period: hobbyChartDate ? "day" : hobbyPeriod,
        referenceDate: chartReferenceDate,
      });

      try {
        const result = await requestApi<Hobby[]>(`/api/hobbies?${query}`);
        if (active) {
          setHobbies(result);
          setHobbyStatus("");
        }
      } catch (error) {
        if (active) {
          setHobbyStatus(
            `Could not load hobbies: ${error instanceof Error ? error.message : "Unknown error."}`,
          );
        }
      }
    };

    void loadHobbies();
    return () => {
      active = false;
    };
  }, [todayDate, summaryDate, hobbyPeriod, hobbyChartDate, hobbyRefresh]);

  useEffect(() => {
    if (!todayDate) {
      return;
    }
    let active = true;
    const query = new URLSearchParams({
      period: journalPeriod,
      ...(journalPeriod === "all" ? {} : { date: journalReferenceDate }),
    });

    void requestApi<JournalEntry[]>(`/api/journal?${query}`)
      .then((entries) => {
        if (active) {
          setJournalEntries(entries);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setJournalStatus(
            `Could not load journal entries: ${error instanceof Error ? error.message : "Unknown error."}`,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [todayDate, journalPeriod, journalReferenceDate, journalRefresh]);

  useEffect(() => {
    if (!sleepMonth) {
      return;
    }
    let active = true;
    void requestApi<SleepRecord[]>(`/api/sleep?month=${encodeURIComponent(sleepMonth)}`)
      .then((records) => {
        if (active) {
          setSleepRecords(records);
          const selected = records.find((record) => record.date === sleepDate);
          setHoursSlept(selected ? String(selected.hoursSlept) : "");
          setSleepStatus("");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSleepStatus(
            `Could not load sleep records: ${error instanceof Error ? error.message : "Unknown error."}`,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [sleepMonth, sleepDate, sleepRefresh]);

  useEffect(() => {
    if (!summaryDate) {
      return;
    }
    let active = true;
    const summaryMonth = summaryDate.slice(0, 7);
    void requestApi<SleepRecord[]>(`/api/sleep?month=${encodeURIComponent(summaryMonth)}`)
      .then((records) => {
        if (active) {
          setSummarySleepRecord(records.find((record) => record.date === summaryDate) ?? null);
          setSummarySleepStatus("");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSummarySleepStatus(
            `Could not load sleep summary: ${error instanceof Error ? error.message : "Unknown error."}`,
          );
        }
      });

    return () => {
      active = false;
    };
  }, [summaryDate, sleepRefresh]);

  const hobbyBreakdown = useMemo(
    () =>
      hobbies.map((item) => ({
        name: item.name,
        checks: item.checkCount,
        color: HOBBY_COLORS[Math.abs(item.name.length) % HOBBY_COLORS.length],
      })),
    [hobbies],
  );

  const totalChecks = hobbies.reduce((sum, item) => sum + item.checkCount, 0);
  const chartGradient = buildChartGradient(hobbyBreakdown);
  const selectedMoment = journalEntries.find((entry) => entry.date === journalReferenceDate);
  const currentJournalEntry = journalEntries.find((entry) => entry.date === journalDate);
  const journalDraftValue =
    journalDraftDate === journalDate ? journalDraft : currentJournalEntry?.text ?? "";
  const filteredJournalEntries = journalEntries
    .filter((entry) => isInJournalPeriod(entry.date, journalPeriod, journalReferenceDate))
    .sort((left, right) => right.date.localeCompare(left.date));

  const dailySummaryHobbies = hobbies.filter((item) => item.checked).slice(0, 3).map((item) => ({
    name: item.name,
    detail: "Checked in for this date",
  }));

  const monthDays = sleepMonth
    ? new Date(Number(sleepMonth.slice(0, 4)), Number(sleepMonth.slice(5, 7)), 0).getDate()
    : 31;
  const sleepLineSegments = getSleepLineSegments(sleepRecords, monthDays);

  const refreshHobbies = () => setHobbyRefresh((value) => value + 1);

  const addHobby = async () => {
    const value = newHobby.trim();
    if (!value) {
      return;
    }

    try {
      await requestApi("/api/hobbies", {
        method: "POST",
        body: JSON.stringify({ name: value }),
      });
      setNewHobby("");
      setHobbyStatus("Hobby saved.");
      refreshHobbies();
    } catch (error) {
      setHobbyStatus(
        `Could not save hobby: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  };

  const toggleHobby = async (item: Hobby) => {
    const selected = !item.checked;
    try {
      await requestApi(`/api/hobbies/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ checked: selected, date: summaryDate }),
      });
      refreshHobbies();
    } catch (error) {
      setHobbyStatus(
        `Could not update hobby: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  };

  const removeHobby = async (id: number) => {
    try {
      await requestApi(`/api/hobbies/${id}`, { method: "DELETE" });
      setHobbyStatus("Hobby deleted.");
      refreshHobbies();
    } catch (error) {
      setHobbyStatus(
        `Could not delete hobby: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  };

  const saveJournalEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = journalDraftValue.trim();
    if (!text) {
      setJournalStatus("Write a memorable moment before saving.");
      return;
    }
    if (!journalDate) {
      setJournalStatus("Choose a date for this memorable moment.");
      return;
    }

    try {
      await requestApi("/api/journal", {
        method: "POST",
        body: JSON.stringify({ date: journalDate, text }),
      });
      setJournalStatus("Memorable moment saved.");
      setJournalDraftDate("");
      setJournalRefresh((value) => value + 1);
    } catch (error) {
      setJournalStatus(
        `Could not save this moment: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  };

  const selectJournalDate = (date: string) => {
    setSelectedJournalDate(date);
    setSelectedJournalReferenceDate(date);
    setJournalPeriod("day");
    setJournalDraftDate(date);
    setJournalDraft(journalEntries.find((entry) => entry.date === date)?.text ?? "");
    setJournalStatus("");
  };

  const editJournalEntry = (entry: JournalEntry) => {
    selectJournalDate(entry.date);
    setJournalDraft(entry.text);
    document.getElementById("journalEntry")?.focus();
  };

  const deleteJournalEntry = async (date: string) => {
    try {
      await requestApi(`/api/journal?date=${encodeURIComponent(date)}`, { method: "DELETE" });
      setJournalStatus("Journal entry deleted.");
      setJournalRefresh((value) => value + 1);
    } catch (error) {
      setJournalStatus(
        `Could not delete journal entry: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  };

  const saveSleepRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hoursValue = Number(hoursSlept);
    if (!sleepDate || !hoursSlept || !Number.isFinite(hoursValue) || hoursValue < 0 || hoursValue > 12) {
      setSleepStatus("Choose a date and enter hours of sleep from 0 to 12.");
      return;
    }

    try {
      await requestApi("/api/sleep", {
        method: "POST",
        body: JSON.stringify({ date: sleepDate, hoursSlept: hoursValue }),
      });
      setSleepStatus("Hours of sleep saved.");
      setSleepRefresh((value) => value + 1);
      if (sleepDate === summaryDate) {
        setSelectedSummaryDate(sleepDate);
      }
    } catch (error) {
      setSleepStatus(
        `Could not save sleep record: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  };

  return (
    <div className="dashboard-page">
      <main className="dashboard-layout">
        <header className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">YOUR PROGRESS</p>
            <h1>Habit dashboard</h1>
            <p>Signed in as {username}. See how your hobbies are adding up.</p>
          </div>
          <button
            className="sign-out-button"
            type="button"
            onClick={async () => {
              try {
                await requestApi("/api/auth/session", { method: "DELETE" });
                router.replace("/login");
              } catch (error) {
                setHobbyStatus(
                  `Could not sign out: ${error instanceof Error ? error.message : "Unknown error."}`,
                );
              }
            }}
          >
            Sign out
          </button>
        </header>

        <section className="daily-summary-card card" aria-labelledby="dailySummaryTitle">
          <div className="daily-summary-header">
            <div>
              <p className="hobby-chart-eyebrow">YOUR DAY</p>
              <h2 id="dailySummaryTitle">Daily summary</h2>
              <p>Review your hobbies, memorable moments, and sleep for a selected date.</p>
            </div>
            <div className="daily-summary-date-control">
              <label htmlFor="dailySummaryDate">Date</label>
              <input
                id="dailySummaryDate"
                type="date"
                value={summaryDate}
                onChange={(event) => {
                  setSelectedSummaryDate(event.target.value);
                  setSelectedJournalReferenceDate(event.target.value);
                }}
              />
            </div>
          </div>

          <div className="daily-summary-grid">
            <section className="daily-summary-section" aria-labelledby="dailySummaryHobbiesTitle">
              <h3 id="dailySummaryHobbiesTitle">Hobbies</h3>
              <ul className="daily-summary-list">
                {dailySummaryHobbies.length > 0 ? (
                  dailySummaryHobbies.map((item) => (
                    <li key={item.name}>
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                    </li>
                  ))
                ) : (
                  <li>
                    <strong>No check-ins for this date</strong>
                    <span>Use Manage hobbies to record an activity.</span>
                  </li>
                )}
              </ul>
            </section>

            <section className="daily-summary-section" aria-labelledby="dailySummaryMomentsTitle">
              <h3 id="dailySummaryMomentsTitle">Memorable moments</h3>
              <ul className="daily-summary-list">
                <li>
                  {selectedMoment ? (
                    <>
                      <strong>{formatJournalDate(selectedMoment.date)}</strong>
                      <span>{selectedMoment.text}</span>
                    </>
                  ) : (
                    <>
                      <strong>No moment recorded</strong>
                      <span>Save a memorable moment for {journalReferenceDate ? formatJournalDate(journalReferenceDate) : "this date"}.</span>
                    </>
                  )}
                </li>
              </ul>
            </section>

            <section className="daily-summary-section" aria-labelledby="dailySummarySleepTitle">
              <h3 id="dailySummarySleepTitle">Sleep</h3>
              <p className="daily-summary-sleep">
                {summarySleepRecord ? `${summarySleepRecord.hoursSlept.toFixed(1)}h` : "--"}
              </p>
              <p className="daily-summary-status" role="status" aria-live="polite">
                {summarySleepStatus ||
                  (summarySleepRecord
                    ? `${summarySleepRecord.hoursSlept} hours recorded`
                    : "No sleep record for this date.")}
              </p>
            </section>
          </div>
        </section>

        <section className="hobbiesPie" aria-labelledby="hobbyChartTitle">
          <div className="card">
            <div className="hobby-chart-header">
              <div>
                <p className="hobby-chart-eyebrow">ACTIVITY BREAKDOWN</p>
                <h2 id="hobbyChartTitle">Hobby checks</h2>
                <p className="hobby-chart-description">Your completed hobby check-ins by activity.</p>
              </div>
              <button className="manage-hobbies-button" type="button" onClick={() => setIsDialogOpen(true)}>
                Manage hobbies
              </button>
            </div>

            <div className="hobby-chart-toolbar">
              <label htmlFor="hobbyChartPeriod">Period</label>
              <select
                id="hobbyChartPeriod"
                value={hobbyPeriod}
                onChange={(event) => {
                  setHobbyPeriod(event.target.value);
                  setHobbyChartDate("");
                }}
              >
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="year">This year</option>
              </select>
              <label htmlFor="hobbyChartDate">Or choose a date</label>
              <input
                id="hobbyChartDate"
                type="date"
                value={hobbyChartDate}
                onChange={(event) => setHobbyChartDate(event.target.value)}
              />
              <p className="hobby-chart-total">
                <strong>{totalChecks}</strong>
                <span>{hobbyChartDate ? "checks on this date" : `checks this ${hobbyPeriod}`}</span>
              </p>
            </div>
            <p className="hobby-chart-filter-help">Changing the period shows that range; choosing a date shows that day.</p>
            <p className="hobby-status" role="status" aria-live="polite">{hobbyStatus}</p>

            <div className="hobby-chart-layout">
              <div className="hobby-chart-visual">
                <div
                  className="hobby-chart-donut"
                  style={{ background: `conic-gradient(${chartGradient})` }}
                  aria-label={`Pie chart of hobby checks ${hobbyChartDate ? `on ${hobbyChartDate}` : `this ${hobbyPeriod}`}`}
                >
                  <div className="hobby-chart-donut-center">
                    <strong>{totalChecks}</strong>
                    <span>check-ins</span>
                  </div>
                </div>
              </div>

              <div className="hobby-chart-legend-panel">
                <h3>By hobby</h3>
                <ul className="hobby-chart-legend" aria-label="Hobby check counts">
                  {hobbyBreakdown.length > 0 ? (
                    hobbyBreakdown.map((item) => (
                      <li key={item.name}>
                        <span className="hobby-chart-swatch" style={{ background: item.color }} aria-hidden="true" />
                        <span>{item.name}</span>
                        <strong>{item.checks}</strong>
                      </li>
                    ))
                  ) : (
                    <li>
                      <span className="hobby-chart-swatch" style={{ background: "#e2e8f0" }} aria-hidden="true" />
                      <span>No hobbies yet</span>
                      <strong>0</strong>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="journal-card card" aria-labelledby="journalTitle">
          <div className="journal-header">
            <div>
              <p className="hobby-chart-eyebrow">YOUR JOURNAL</p>
              <h2 id="journalTitle">Memorable moments</h2>
              <p>
                Today is <time dateTime={todayDate}>{todayDate ? formatJournalDate(todayDate) : "loading"}</time>. Save a moment worth remembering.
              </p>
            </div>
          </div>

          <form className="journal-form" onSubmit={saveJournalEntry}>
            <label htmlFor="journalDateInput">Entry date</label>
            <input
              id="journalDateInput"
              type="date"
              value={journalDate}
              onChange={(event) => selectJournalDate(event.target.value)}
              required
            />
            <label htmlFor="journalEntry">Memorable moment</label>
            <textarea
              id="journalEntry"
              name="moment"
              rows={4}
              maxLength={10000}
              placeholder="What made today memorable?"
              value={journalDraftValue}
              onChange={(event) => {
                setJournalDraftDate(journalDate);
                setJournalDraft(event.target.value);
              }}
              required
            />
            <div className="journal-form-footer">
              <p className="journal-status" role="status" aria-live="polite">
                {journalStatus}
              </p>
              <button type="submit">{currentJournalEntry ? "Update entry" : "Save entry"}</button>
            </div>
          </form>

          <div className="journal-history">
            <div className="journal-history-header">
              <h3>Journal history</h3>
              <div className="journal-filters">
                <label htmlFor="journalPeriod">View</label>
                <select
                  id="journalPeriod"
                  value={journalPeriod}
                  onChange={(event) => setJournalPeriod(event.target.value)}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="all">All entries</option>
                </select>
                <label htmlFor="journalReferenceDate">Reference date</label>
                <input
                  id="journalReferenceDate"
                  type="date"
                  value={journalReferenceDate}
                  onChange={(event) => setSelectedJournalReferenceDate(event.target.value)}
                  disabled={journalPeriod === "all"}
                />
              </div>
            </div>

            {filteredJournalEntries.length ? (
              <ol className="journal-entries" aria-live="polite">
                {filteredJournalEntries.map((entry) => (
                  <li key={entry.date} className="journal-entry">
                    <time dateTime={entry.date}>{formatJournalDate(entry.date)}</time>
                    <p>{entry.text}</p>
                    <button type="button" className="journal-edit-button" onClick={() => editJournalEntry(entry)}>
                      Edit entry
                    </button>
                    <button
                      type="button"
                      className="journal-delete-button"
                      onClick={() => deleteJournalEntry(entry.date)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="journal-empty" role="status">
                No entries found for this period. Save a memorable moment above to start your journal.
              </p>
            )}
          </div>
        </section>

        <section className="daily-score-card card" aria-labelledby="dailyScoreTitle">
          <div className="daily-score-header">
            <div>
              <p className="hobby-chart-eyebrow">MONTHLY OVERVIEW</p>
              <h2 id="dailyScoreTitle">Daily sleep score</h2>
              <p>Record your hours of sleep for any date; the chart shows that date&apos;s month.</p>
            </div>
            <p className="daily-score-month">
              {sleepMonth
                ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
                    new Date(Number(sleepMonth.slice(0, 4)), Number(sleepMonth.slice(5, 7)) - 1, 1),
                  )
                : ""}
            </p>
          </div>

          <form className="daily-score-form" onSubmit={saveSleepRecord}>
            <div className="daily-score-field">
              <label htmlFor="dailyScoreDate">Sleep date</label>
              <input
                id="dailyScoreDate"
                name="date"
                type="date"
                value={sleepDate}
                onChange={(event) => setSleepDateSelection(event.target.value)}
                required
              />
            </div>
            <div className="daily-score-field">
              <label htmlFor="hoursSlept">Hours of sleep</label>
              <input
                id="hoursSlept"
                name="hoursSlept"
                type="number"
                min="0"
                max="12"
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 7.5"
                value={hoursSlept}
                onChange={(event) => setHoursSlept(event.target.value)}
                required
              />
            </div>
            <button type="submit">Save hours</button>
          </form>
          <p className="sleep-status" role="status" aria-live="polite">{sleepStatus}</p>

          <div className="daily-score-chart-wrapper">
            <svg
              className="daily-score-chart"
              viewBox="0 0 1000 280"
              role="img"
              aria-label={`Daily sleep duration in hours for ${sleepMonth || "the selected month"}`}
            >
              <g>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((tick) => (
                  <g key={tick}>
                    <line
                      x1="40"
                      x2="960"
                      y1={200 - tick * 14}
                      y2={200 - tick * 14}
                      className="daily-score-gridline"
                    />
                    <text
                      x="32"
                      y={200 - tick * 14}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="daily-score-axis-label"
                    >
                      {tick}
                    </text>
                  </g>
                ))}
                {Array.from({ length: monthDays }, (_, index) => index + 1).map((day) => (
                  <line
                    key={day}
                    x1={40 + ((day - 1) / Math.max(monthDays - 1, 1)) * 920}
                    x2={40 + ((day - 1) / Math.max(monthDays - 1, 1)) * 920}
                    y1="30"
                    y2="220"
                    className="daily-score-gridline daily-score-gridline-vertical"
                  />
                ))}
              </g>
              {sleepLineSegments.map((segment, index) => (
                <path
                  key={`${segment.color}-${index}`}
                  d={segment.d}
                  className={`daily-score-line daily-score-line-${segment.color}`}
                />
              ))}
              <line x1="40" y1="144" x2="960" y2="144" className="daily-score-threshold" />
              {sleepRecords.map((record) => {
                const { x, y } = getSleepChartPoint(record, monthDays);
                const color = record.hoursSlept <= 4 ? "red" : "blue";
                return (
                  <circle
                    key={record.date}
                    cx={x}
                    cy={y}
                    r="4"
                    className={`daily-score-point daily-score-point-${color}`}
                    aria-label={`${record.date}: ${record.hoursSlept} hours`}
                  />
                );
              })}
            </svg>
          </div>
        </section>
      </main>

      <div
        className={`hobbies-dialog ${isDialogOpen ? "open" : ""}`}
        role="dialog"
        aria-modal={isDialogOpen}
        aria-hidden={!isDialogOpen}
        aria-labelledby="manageHobbiesTitle"
        hidden={!isDialogOpen}
      >
        <div className="hobbies-dialog-header">
          <h2 id="manageHobbiesTitle">Manage your hobbies</h2>
          <button type="button" className="hobbies-dialog-close" aria-label="Close" onClick={() => setIsDialogOpen(false)}>
            &times;
          </button>
        </div>

        <div className="hobby-management-panel">
          <div className="hobby-input-row">
            <input
              type="text"
              value={newHobby}
              onChange={(event) => setNewHobby(event.target.value)}
              placeholder="Add a hobby"
              maxLength={255}
              aria-label="Hobby name"
            />
            <button type="button" onClick={() => void addHobby()}>Add hobby</button>
          </div>

          <div className="hobby-management-list">
            {hobbies.length > 0 ? (
              hobbies.map((item) => (
                <div key={item.id} className="hobby-management-item">
                  <label className="hobby-management-toggle">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => void toggleHobby(item)}
                    />
                    <span>{item.name}</span>
                  </label>

                  <div className="hobby-management-meta">
                    <span>
                      {item.checked ? "Checked in for selected date" : `Created · ${formatTimestamp(item.createdAt)}`}
                      {` · ${item.checkCount} checks in selected range · ${item.allTimeCount} total`}
                    </span>
                    <button type="button" className="delete-btn" onClick={() => void removeHobby(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-state">You have no hobbies yet. Add one to get started.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
