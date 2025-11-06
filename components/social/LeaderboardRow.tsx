import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Avatar from "@/components/ui/Avatar";

export type LeaderboardEntry = {
  userId: string;
  handle: string;
  avatarUrl?: string | null;
  weeklyReps: number;
  daysMet: number;
  streak: number;
  lastActive?: string; // YYYY-MM-DD
};

interface LeaderboardRowProps {
  rank: number;
  entry: LeaderboardEntry;
  metricValue: number;
  metricLabel: string;
  onPress?: (entry: LeaderboardEntry) => void;
}

export default function LeaderboardRow({
  rank,
  entry,
  metricValue,
  metricLabel,
  onPress,
}: LeaderboardRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rank}>{rank}</Text>
      <Avatar
        uri={entry.avatarUrl ?? undefined}
        name={entry.handle}
        size={36}
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.handle}>@{entry.handle || "user"}</Text>
        <Text style={styles.sub}>
          {entry.daysMet}/7 days • Streak {entry.streak}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.reps}>{metricValue}</Text>
        <Text style={styles.repsLabel}>{metricLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1720",
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rank: {
    width: 28,
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: "800",
  },
  handle: { color: "#e6f0f2", fontWeight: "700" },
  sub: { color: "#94a3b8", marginTop: 2, fontSize: 12 },
  right: { alignItems: "flex-end" },
  reps: { color: "#20e5e5", fontWeight: "900", fontSize: 18 },
  repsLabel: { color: "#94a3b8", fontSize: 10 },
});
