import { View, Text, StyleSheet } from "react-native";

interface ExerciseCardProps {
  name: string;
  current: number;
  goal: number;
  emoji: string;
}

export default function ExerciseCard({
  name,
  current,
  goal,
  emoji,
}: ExerciseCardProps) {
  const isComplete = current >= goal;
  const progress = Math.max(0, Math.min(1, current / Math.max(1, goal)));
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>
            {current}/{goal} {isComplete ? "• Complete" : ""}
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 24 },
  name: { color: "#e6f0f2", fontSize: 16, fontWeight: "700" },
  sub: { color: "#94a3b8", marginTop: 2 },
  track: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#0f1c24",
    overflow: "hidden",
  },
  fill: {
    height: 8,
    backgroundColor: "#20e5e5",
    shadowColor: "#20e5e5",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
