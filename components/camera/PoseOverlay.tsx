import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

export default function PoseOverlay({
  tracking,
  reps,
  progress = 0,
}: {
  tracking: boolean;
  reps: number;
  progress?: number;
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
        <View style={styles.circleWrap}>
          <Svg width={96} height={96}>
            <Circle
              cx={48}
              cy={48}
              r={42}
              stroke="#0f1c24"
              strokeWidth={8}
              fill="none"
            />
            <Circle
              cx={48}
              cy={48}
              r={42}
              stroke="#20e5e5"
              strokeWidth={8}
              strokeDasharray={`${
                2 * Math.PI * 42 * Math.max(0, Math.min(1, progress))
              } ${2 * Math.PI * 42}`}
              strokeLinecap="round"
              rotation={-90}
              originX={48}
              originY={48}
              fill="none"
            />
          </Svg>
          <Text style={styles.counter}>{reps}</Text>
        </View>
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
  counter: {
    color: "#e6f0f2",
    fontSize: 32,
    fontWeight: "800",
    position: "absolute",
  },
  circleWrap: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
});
