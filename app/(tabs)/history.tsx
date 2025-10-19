import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import Svg, { Circle } from "react-native-svg";

type DayRec = {
  date: string;
  met_goal: boolean;
  totals: { pushup?: number; squat?: number };
};

export default function HistoryScreen() {
  const { user } = useAuth();
  const [days, setDays] = useState<DayRec[]>([]);
  const [selected, setSelected] = useState<DayRec | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const sinceStr = since.toISOString().split("T")[0];
      const { data } = await supabase
        .from("daily_totals")
        .select("date,met_goal,totals")
        .eq("user_id", user.id)
        .gte("date", sinceStr)
        .order("date", { ascending: true });
      const map = new Map<string, DayRec>();
      data?.forEach((d) =>
        map.set(d.date, {
          date: d.date,
          met_goal: d.met_goal,
          totals: d.totals as any,
        })
      );
      const out: DayRec[] = [];
      for (let i = 29; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const key = dt.toISOString().split("T")[0];
        out.push(map.get(key) ?? { date: key, met_goal: false, totals: {} });
      }
      setDays(out);
      setSelected(out[out.length - 1] ?? null);
    })();
  }, [user]);

  const weeklyStreak = useMemo(() => {
    const last7 = days.slice(-7);
    return last7.filter((d) => d.met_goal).length;
  }, [days]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>History</Text>

      {/* Weekly streak ring */}
      <View style={styles.ringWrap}>
        <Ring value={weeklyStreak} max={7} />
        <Text style={styles.ringLabel}>{weeklyStreak}/7</Text>
        <Text style={styles.sub}>Weekly streak</Text>
      </View>

      {/* 30-day heatmap (6 rows x 5 cols) */}
      <View style={styles.grid}>
        {days.map((d) => (
          <TouchableOpacity
            key={d.date}
            style={[styles.cell, d.met_goal ? styles.cellOn : styles.cellOff]}
            onPress={() => setSelected(d)}
          />
        ))}
      </View>

      {/* Day details */}
      {selected && (
        <View style={styles.details}>
          <Text style={styles.detailsDate}>{selected.date}</Text>
          <Text style={styles.detailsText}>
            Push-Ups: {selected.totals.pushup ?? 0}
          </Text>
          <Text style={styles.detailsText}>
            Squats: {selected.totals.squat ?? 0}
          </Text>
          <Text
            style={[
              styles.detailsText,
              { color: selected.met_goal ? "#20e5e5" : "#94a3b8" },
            ]}
          >
            {selected.met_goal ? "Daily habit complete" : "Not complete"}
          </Text>
        </View>
      )}
    </ScrollView>
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

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: "#04080d" },
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
  ringLabel: {
    position: "absolute",
    color: "#e6f0f2",
    fontWeight: "800",
    fontSize: 18,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: 20, height: 20, borderRadius: 6 },
  cellOn: { backgroundColor: "#20e5e5" },
  cellOff: { backgroundColor: "#0f1c24" },
  details: {
    marginTop: 16,
    backgroundColor: "#0f1720",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  detailsDate: { color: "#e6f0f2", fontWeight: "700", marginBottom: 6 },
  detailsText: { color: "#94a3b8", marginTop: 2 },
});
