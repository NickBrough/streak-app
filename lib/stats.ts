import { toLocalDayUtcKey } from "@/lib/date";

export type StatsDay = {
  date: string; // YYYY-MM-DD (UTC-encoded local day)
  met_goal: boolean;
  totals?: { pushup?: number; squat?: number; [k: string]: number | undefined };
};

function buildFilledRangeMap(
  days: StatsDay[],
  rangeDays: number,
  end: Date = new Date()
): { series: StatsDay[]; map: Map<string, StatsDay> } {
  const map = new Map<string, StatsDay>();
  for (const d of days) {
    map.set(d.date, {
      date: d.date,
      met_goal: !!d.met_goal,
      totals: d.totals ?? {},
    });
  }
  const series: StatsDay[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const dt = new Date(end);
    dt.setDate(end.getDate() - i);
    const key = toLocalDayUtcKey(dt);
    series.push(
      map.get(key) ?? {
        date: key,
        met_goal: false,
        totals: {},
      }
    );
  }
  return { series, map };
}

export function computeCurrentStreak(
  allDays: StatsDay[],
  today: Date = new Date()
): number {
  const map = new Map<string, StatsDay>();
  for (const d of allDays) map.set(d.date, d);
  let streak = 0;
  // Walk backward from today until a non-met or missing day
  for (let i = 0; i < 366; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const key = toLocalDayUtcKey(dt);
    const rec = map.get(key);
    if (!rec || !rec.met_goal) break;
    streak += 1;
  }
  return streak;
}

export function computeLongestStreak(
  allDays: StatsDay[],
  today: Date = new Date()
): number {
  if (allDays.length === 0) return 0;
  // Determine span from first known date to today
  const minKey = allDays.reduce(
    (min, d) => (d.date < min ? d.date : min),
    allDays[0].date
  );
  const start = new Date(
    Number(minKey.slice(0, 4)),
    Number(minKey.slice(5, 7)) - 1,
    Number(minKey.slice(8, 10))
  );
  const totalDays =
    Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const { series, map } = buildFilledRangeMap(allDays, totalDays, today);
  // Reuse series for order; map used above for construction
  let best = 0;
  let cur = 0;
  for (let i = 0; i < series.length; i++) {
    if (series[i].met_goal) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

export function computeAdherence(
  days: StatsDay[],
  rangeDays = 30,
  today: Date = new Date()
): { daysMet: number; totalDays: number; percent: number } {
  const { series } = buildFilledRangeMap(days, rangeDays, today);
  const daysMet = series.filter((d) => d.met_goal).length;
  const percent = rangeDays === 0 ? 0 : Math.round((daysMet / rangeDays) * 100);
  return { daysMet, totalDays: rangeDays, percent };
}

export function computeTotals(
  days: StatsDay[],
  rangeDays = 30,
  today: Date = new Date()
): { pushup: number; squat: number; reps: number } {
  const { series } = buildFilledRangeMap(days, rangeDays, today);
  let pushup = 0;
  let squat = 0;
  for (const d of series) {
    pushup += d.totals?.pushup ?? 0;
    squat += d.totals?.squat ?? 0;
  }
  return { pushup, squat, reps: pushup + squat };
}

export function weekdayConsistency(
  days: StatsDay[],
  weeks = 12,
  today: Date = new Date()
): number[] {
  const rangeDays = weeks * 7;
  const { series } = buildFilledRangeMap(days, rangeDays, today);
  const counts = Array.from({ length: 7 }, () => 0);
  for (const d of series) {
    const [y, m, dd] = d.date.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, dd ?? 1);
    const w = dt.getDay(); // 0=Sun..6=Sat
    if (d.met_goal) counts[w] += 1;
  }
  return counts;
}

export function bucketizeReps(
  days: StatsDay[],
  rangeDays = 30,
  today: Date = new Date()
): Array<{ date: string; bucket: 0 | 1 | 2 | 3 }> {
  const { series } = buildFilledRangeMap(days, rangeDays, today);
  const reps = series.map(
    (d) => (d.totals?.pushup ?? 0) + (d.totals?.squat ?? 0)
  );
  const nonZero = reps.filter((r) => r > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) {
    return series.map((d) => ({ date: d.date, bucket: 0 }));
  }
  const q = (p: number) => {
    const idx = Math.floor((nonZero.length - 1) * p);
    return nonZero[idx];
  };
  const t1 = q(0.33);
  const t2 = q(0.66);
  const t3 = q(0.9); // make top bucket a bit rarer
  return series.map((d) => {
    const v = (d.totals?.pushup ?? 0) + (d.totals?.squat ?? 0);
    let bucket: 0 | 1 | 2 | 3 = 0;
    if (v > 0 && v <= t1) bucket = 1;
    else if (v > t1 && v <= t2) bucket = 2;
    else if (v > t2) bucket = 3;
    // clamp very top to 3; t3 is used to bias distribution but not strict
    return { date: d.date, bucket };
  });
}
