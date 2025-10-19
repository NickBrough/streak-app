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
      <Text style={styles.streak}>{currentStreak}</Text>
      <View style={styles.row}>
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
  label: { color: "#94a3b8", marginBottom: 4 },
  streak: {
    color: "#e6f0f2",
    fontSize: 48,
    fontWeight: "800",
    marginBottom: 8,
    textShadowColor: "rgba(32,229,229,0.5)",
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  row: { flexDirection: "row", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotOn: { backgroundColor: "#20e5e5" },
  dotOff: { backgroundColor: "#1f2a35" },
});
