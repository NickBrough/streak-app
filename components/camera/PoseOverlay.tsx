import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PoseOverlay({
  tracking,
  reps,
}: {
  tracking: boolean;
  reps: number;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.badge}>
        <View style={[styles.dot, tracking ? styles.dotOn : styles.dotOff]} />
        <Text style={styles.badgeText}>
          {tracking ? "Tracking" : "Finding…"}
        </Text>
      </View>
      <View style={styles.counterWrap}>
        <Text style={styles.counter}>{reps}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 999, marginRight: 8 },
  dotOn: { backgroundColor: "#20e5e5" },
  dotOff: { backgroundColor: "#64748b" },
  badgeText: { color: "#e6f0f2", fontWeight: "600" },
  counterWrap: { position: "absolute", bottom: 40, alignSelf: "center" },
  counter: { color: "#e6f0f2", fontSize: 72, fontWeight: "800" },
});
