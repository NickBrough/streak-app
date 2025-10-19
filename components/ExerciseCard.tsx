import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface ExerciseCardProps {
  name: string;
  current: number;
  goal: number;
  emoji: string;
  onStart?: () => void;
}

export default function ExerciseCard({
  name,
  current,
  goal,
  emoji,
  onStart,
}: ExerciseCardProps) {
  const isComplete = current >= goal;
  const progress = Math.max(0, Math.min(1, current / Math.max(1, goal)));
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>
            {current}/{goal} {isComplete ? "• Complete" : ""}
          </Text>
        </View>
        {onStart ? (
          <TouchableOpacity style={styles.startBtn} onPress={onStart}>
            <Text style={styles.startText}>
              {isComplete ? "Again" : "Start"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
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
  startBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(32,229,229,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(32,229,229,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  startText: { color: "#20e5e5", fontWeight: "700", fontSize: 12 },
});
