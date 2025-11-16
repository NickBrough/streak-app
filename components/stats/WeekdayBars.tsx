import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface WeekdayBarsProps {
  counts: number[]; // length 7, 0=Sun..6=Sat
}

export default function WeekdayBars({ counts }: WeekdayBarsProps) {
  const max = Math.max(1, ...counts);
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return (
    <View style={styles.wrap}>
      {counts.map((c, i) => {
        const h = Math.max(4, Math.round((c / max) * 48));
        return (
          <View key={dayKeys[i]} style={styles.item}>
            <View style={[styles.bar, { height: h }]} />
            <Text style={styles.lbl}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  item: { alignItems: "center", flex: 1, gap: 6 },
  bar: {
    width: "100%",
    borderRadius: 6,
    backgroundColor: "rgba(32,229,229,0.55)",
  },
  lbl: { color: "#94a3b8", fontSize: 10 },
});
