import { View, Text, StyleSheet } from "react-native";
import React from "react";
import { toLocalDayUtcKey } from "@/lib/date";
interface StreakDisplayProps {
  days: boolean[];
  currentStreak: number;
}

export default function StreakDisplay({
  days,
  currentStreak,
}: StreakDisplayProps) {
  const unit = currentStreak === 1 ? "day" : "days";
  const dayInitials = ["S", "M", "T", "W", "T", "F", "S"];
  const computeLabelForIndex = (index: number) => {
    // index 6 is today, 0 is 6 days ago
    const today = new Date();
    const daysAgo = 6 - index;
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    const w = d.getDay();
    return dayInitials[w];
  };
  return (
    <View>
      <Text style={styles.label}>Current Streak</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Text style={styles.streak}>{currentStreak}</Text>
        <Text style={styles.streakUnit}>{unit} 🔥</Text>
      </View>
      <Text style={styles.subLabel}>7 day challenge</Text>
      <View style={styles.rowDots}>
        {days.map((d, i) => {
          const today = new Date();
          const daysAgo = 6 - i;
          const date = new Date(today);
          date.setDate(today.getDate() - daysAgo);
          const dateKey = toLocalDayUtcKey(date);
          const label = computeLabelForIndex(i);
          return (
            <View key={dateKey} style={styles.dotContainer}>
              <View style={[styles.dot, d ? styles.dotOn : styles.dotOff]} />
              <Text style={styles.dayLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: "#94a3b8", marginBottom: 2 },
  subLabel: { color: "#64748b", marginTop: 6, marginBottom: 8, fontSize: 12 },
  streak: {
    color: "#e6f0f2",
    fontSize: 56,
    fontWeight: "800",
    marginBottom: 0,
    textShadowColor: "rgba(32,229,229,0.5)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  streakUnit: { color: "#94a3b8", fontSize: 14, marginBottom: 6 },
  rowDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  dotContainer: { flex: 1, alignItems: "center", gap: 2 },
  dot: { width: 14, height: 14, borderRadius: 6, borderWidth: 1 },
  dotOn: { backgroundColor: "#20e5e5", borderColor: "#20e5e5" },
  dotOff: {
    backgroundColor: "transparent",
    borderColor: "rgba(148,163,184,0.25)",
  },
  dayLabel: { color: "#94a3b8", fontSize: 10 },
});
