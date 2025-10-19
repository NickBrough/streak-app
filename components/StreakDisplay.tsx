import { View, Text, StyleSheet } from "react-native";

interface StreakDisplayProps {
  days: boolean[];
  currentStreak: number;
}

export default function StreakDisplay({
  days,
  currentStreak,
}: StreakDisplayProps) {
  return (
    <View>
      <Text style={styles.label}>Current Streak</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <Text style={styles.streak}>{currentStreak}</Text>
        <Text style={styles.streakUnit}>days 🔥</Text>
      </View>
      <Text style={styles.subLabel}>7 day challenge</Text>
      <View style={styles.rowDots}>
        {days.map((d, i) => (
          <View
            key={i}
            style={[styles.dot, d ? styles.dotOn : styles.dotOff]}
          />
        ))}
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
  rowDots: { flexDirection: "row", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: "#20e5e5" },
  dotOff: { backgroundColor: "#1f2a35" },
});
