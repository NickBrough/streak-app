import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";

interface StatTileProps {
  title: string;
  value: string | number;
  sublabel?: string;
  style?: ViewStyle;
  accent?: "teal" | "default";
}

export default function StatTile({
  title,
  value,
  sublabel,
  style,
  accent = "teal",
}: StatTileProps) {
  return (
    <View style={[styles.tile, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, accent === "teal" && styles.valueTeal]}>
        {value}
      </Text>
      {sublabel ? <Text style={styles.sub}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: "#0f1720",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    minWidth: 100,
  },
  title: {
    color: "#94a3b8",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    fontWeight: "700",
  },
  value: {
    color: "#e6f0f2",
    fontSize: 20,
    fontWeight: "800",
  },
  valueTeal: {
    color: "#20e5e5",
  },
  sub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
  },
});
