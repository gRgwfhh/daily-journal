export type SleepChartRecord = {
  date: string;
  hoursSlept: number;
};

export type SleepLineSegment = {
  color: "red" | "blue";
  d: string;
};

const CHART_LEFT = 40;
const CHART_WIDTH = 920;
const CHART_BOTTOM = 200;
const CHART_HOURS_SCALE = 14;
const TARGET_HOURS = 4;

function isAboveTarget(hours: number) {
  return hours > TARGET_HOURS;
}

export function getSleepChartPoint(record: SleepChartRecord, daysInMonth: number) {
  const day = Number(record.date.slice(8, 10));
  return {
    x: CHART_LEFT + ((day - 1) / Math.max(daysInMonth - 1, 1)) * CHART_WIDTH,
    y: CHART_BOTTOM - Math.min(record.hoursSlept, 12) * CHART_HOURS_SCALE,
  };
}

export function getSleepLineSegments(
  records: SleepChartRecord[],
  daysInMonth: number,
): SleepLineSegment[] {
  const segments: SleepLineSegment[] = [];

  for (let index = 1; index < records.length; index += 1) {
    const previous = records[index - 1];
    const current = records[index];
    if (Number(current.date.slice(8, 10)) - Number(previous.date.slice(8, 10)) !== 1) {
      continue;
    }

    const previousPoint = getSleepChartPoint(previous, daysInMonth);
    const currentPoint = getSleepChartPoint(current, daysInMonth);
    const previousAbove = isAboveTarget(previous.hoursSlept);
    const currentAbove = isAboveTarget(current.hoursSlept);

    if (previousAbove === currentAbove) {
      segments.push({
        color: currentAbove ? "blue" : "red",
        d: `M ${previousPoint.x} ${previousPoint.y} L ${currentPoint.x} ${currentPoint.y}`,
      });
      continue;
    }

    const fraction =
      (TARGET_HOURS - previous.hoursSlept) /
      (current.hoursSlept - previous.hoursSlept);
    const crossingPoint = {
      x: previousPoint.x + fraction * (currentPoint.x - previousPoint.x),
      y: CHART_BOTTOM - TARGET_HOURS * CHART_HOURS_SCALE,
    };
    if (fraction > 0) {
      segments.push({
        d: `M ${previousPoint.x} ${previousPoint.y} L ${crossingPoint.x} ${crossingPoint.y}`,
        color: previousAbove ? "blue" : "red",
      });
    }
    if (fraction < 1) {
      segments.push({
        d: `M ${crossingPoint.x} ${crossingPoint.y} L ${currentPoint.x} ${currentPoint.y}`,
        color: currentAbove ? "blue" : "red",
      });
    }
  }

  return segments;
}
