import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, SectionList } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import Svg, { Circle } from "react-native-svg";
import Screen from "@/components/ui/Screen";
import { toLocalDayUtcKey } from "@/lib/date";
import {
  bucketizeReps,
  computeAdherence,
  computeCurrentStreak,
  computeLongestStreak,
  computeTotals,
  weekdayConsistency,
} from "@/lib/stats";
import StatTile from "@/components/stats/StatTile";
import WeekdayBars from "@/components/stats/WeekdayBars";

type DayRec = {
  date: string;
  met_goal: boolean;
  totals: { pushup?: number; squat?: number };
};

type HistorySection = {
  title: string;
  data: DayRec[];
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const [last30Days, setLast30Days] = useState<DayRec[]>([]);
  const [historyDays, setHistoryDays] = useState<DayRec[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("daily_totals")
        .select("date,met_goal,totals")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      const all: DayRec[] = (data ?? []).map((d: any) => ({
        date: d.date,
        met_goal: !!d.met_goal,
        totals: (d.totals as any) ?? {},
      }));
      setHistoryDays(all.sort((a, b) => (a.date < b.date ? 1 : -1)));

      // Build a filled last-30-days series for the ring/heatmap
      const map = new Map<string, DayRec>();
      for (const d of all) map.set(d.date, d);
      const out: DayRec[] = [];
      for (let i = 29; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const key = toLocalDayUtcKey(dt);
        out.push(map.get(key) ?? { date: key, met_goal: false, totals: {} });
      }
      setLast30Days(out);
    })();
  }, [user]);

  const weeklyStreak = useMemo(() => {
    const last7 = last30Days.slice(-7);
    return last7.filter((d) => d.met_goal).length;
  }, [last30Days]);

  const sections: HistorySection[] = useMemo(() => {
    // Group by stable year-month key (YYYY-MM) derived from the ISO date string
    const byYm = new Map<string, DayRec[]>();
    for (const d of historyDays) {
      const ym = d.date.slice(0, 7);
      const arr = byYm.get(ym) ?? [];
      arr.push(d);
      byYm.set(ym, arr);
    }
    // Sort months descending (newest first) by the YYYY-MM key
    const yms = Array.from(byYm.keys());
    yms.sort((a, b) => (a < b ? 1 : -1));
    return yms.map((ym) => ({
      title: formatMonthTitle(`${ym}-01`),
      data: (byYm.get(ym) ?? []).sort((a, b) => (a.date < b.date ? 1 : -1)),
    }));
  }, [historyDays]);

  const heatmap = useMemo(() => bucketizeReps(historyDays, 30), [historyDays]);
  const currentStreak = useMemo(
    () => computeCurrentStreak(historyDays),
    [historyDays]
  );
  const longestStreak = useMemo(
    () => computeLongestStreak(historyDays),
    [historyDays]
  );
  const adherence = useMemo(
    () => computeAdherence(historyDays, 30),
    [historyDays]
  );
  const totals30 = useMemo(() => computeTotals(historyDays, 30), [historyDays]);
  const weekdayCounts = useMemo(
    () => weekdayConsistency(historyDays, 12),
    [historyDays]
  );
  const mostConsistentIdx = useMemo(() => {
    let best = 0;
    let idx = 0;
    for (let i = 0; i < weekdayCounts.length; i++) {
      if (weekdayCounts[i] > best) {
        best = weekdayCounts[i];
        idx = i;
      }
    }
    return idx;
  }, [weekdayCounts]);
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Screen contentStyle={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.date}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>History</Text>
            <View style={styles.tilesRow}>
              <StatTile
                title="Longest streak"
                value={longestStreak}
                sublabel="days"
                style={{ flex: 1 }}
              />
              <StatTile
                title="30‑day adherence"
                value={`${adherence.percent}%`}
                sublabel={`${adherence.daysMet}/${adherence.totalDays} days`}
                style={{ flex: 1 }}
              />
              <StatTile
                title="30‑day reps"
                value={totals30.reps}
                sublabel={`${totals30.pushup} push • ${totals30.squat} squat`}
                style={{ flex: 1 }}
              />
            </View>
            <View style={styles.ringWrap}>
              <Ring value={weeklyStreak} max={7} />
              <Text style={styles.ringLabel}>{weeklyStreak}/7</Text>
              <Text style={styles.sub}>Weekly streak</Text>
            </View>
            <View style={styles.grid}>
              {heatmap.map((d) => {
                const bucket = d.bucket;
                return (
                  <View
                    key={d.date}
                    style={[
                      styles.cell,
                      bucket === 0
                        ? styles.cellB0
                        : bucket === 1
                        ? styles.cellB1
                        : bucket === 2
                        ? styles.cellB2
                        : styles.cellB3,
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.legendRow}>
              <Text style={styles.legendLabel}>Less</Text>
              <View style={[styles.legendDot, styles.cellB0]} />
              <View style={[styles.legendDot, styles.cellB1]} />
              <View style={[styles.legendDot, styles.cellB2]} />
              <View style={[styles.legendDot, styles.cellB3]} />
              <Text style={styles.legendLabel}>More</Text>
            </View>
            <Text style={styles.sectionLead}>Consistency</Text>
            <WeekdayBars counts={weekdayCounts} />
            <Text style={styles.sub}>
              Most consistent: {weekdayNames[mostConsistentIdx]}
            </Text>
            <Text style={styles.sectionLead}>Activity</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => <HistoryRow item={item} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No history yet. Start your first workout!
          </Text>
        }
      />
    </Screen>
  );
}

function Ring({ value, max }: { value: number; max: number }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const dash = circumference * pct;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="#0f1c24"
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="#20e5e5"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        rotation={-90}
        originX={cx}
        originY={cy}
        fill="none"
      />
    </Svg>
  );
}

function HistoryRow({ item }: { item: DayRec }) {
  const isToday = item.date === toLocalDayUtcKey();
  let label = formatWeekday(item.date);
  if (isToday) {
    label = "Today";
  } else if (isYesterday(item.date)) {
    label = "Yesterday";
  }
  const pushups = item.totals.pushup ?? 0;
  const squats = item.totals.squat ?? 0;
  return (
    <View style={[styles.row, item.met_goal && styles.rowMet]}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowSub}>{formatFullDate(item.date)}</Text>
      </View>
      <View style={styles.rowRight}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>💪 {pushups}</Text>
        </View>
        <View style={[styles.badge, { marginLeft: 8 }]}>
          <Text style={styles.badgeText}>🦵 {squats}</Text>
        </View>
        <View
          style={[
            styles.statusDot,
            item.met_goal ? styles.statusOn : styles.statusOff,
          ]}
        />
      </View>
    </View>
  );
}

function isYesterday(dateKey: string): boolean {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDayUtcKey(d) === dateKey;
}

function formatWeekday(dateKey: string): string {
  const [y, m, dNum] = dateKey.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, dNum ?? 1);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function formatFullDate(dateKey: string): string {
  const [y, m, dNum] = dateKey.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, dNum ?? 1);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthTitle(dateKey: string): string {
  const [y, m, dNum] = dateKey.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, dNum ?? 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Removed fragile monthTitleToKey parsing; use stable YYYY-MM keys instead

const styles = StyleSheet.create({
  container: { padding: 0 },
  heading: {
    color: "#e6f0f2",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  sub: { color: "#94a3b8", marginTop: 4 },
  ringWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  tilesRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  ringLabel: {
    position: "absolute",
    color: "#e6f0f2",
    fontWeight: "800",
    fontSize: 18,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: 20, height: 20, borderRadius: 6 },
  cellB0: { backgroundColor: "#0f1c24" },
  cellB1: { backgroundColor: "rgba(32,229,229,0.25)" },
  cellB2: { backgroundColor: "rgba(32,229,229,0.55)" },
  cellB3: { backgroundColor: "#20e5e5" },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  legendDot: { width: 14, height: 14, borderRadius: 6 },
  legendLabel: { color: "#64748b", fontSize: 12 },
  sectionLead: {
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sectionHeader: {
    backgroundColor: "#06121f",
    paddingVertical: 6,
  },
  sectionTitle: {
    color: "#94a3b8",
    fontWeight: "700",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f1720",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    marginTop: 10,
  },
  rowMet: {
    borderColor: "#20e5e5",
  },
  rowLeft: { flexDirection: "column" },
  rowRight: { flexDirection: "row", alignItems: "center" },
  rowTitle: { color: "#e6f0f2", fontWeight: "700" },
  rowSub: { color: "#94a3b8", marginTop: 2 },
  badge: {
    backgroundColor: "#0f1c24",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  badgeText: { color: "#e6f0f2", fontWeight: "700" },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  statusOn: { backgroundColor: "#20e5e5" },
  statusOff: { backgroundColor: "#0f1c24" },
  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 24,
  },
});
