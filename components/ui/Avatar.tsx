import React from "react";
import { Text, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number; // default 40
}

function getInitials(name?: string | null): string {
  if (!name) return "";
  const base = name.includes("@") ? name.split("@")[0] : name;
  const parts = base
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? base[0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const borderRadius = size / 2;
  const initials = getInitials(name);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius }}
        resizeMode="cover"
      />
    );
  }

  return (
    <LinearGradient
      colors={["#0d1b24", "#07222f", "#043444"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      <Text
        style={{
          color: "#e6f0f2",
          fontWeight: "800",
          fontSize: Math.max(12, size * 0.38),
          letterSpacing: 0.5,
        }}
      >
        {initials || "👤"}
      </Text>
    </LinearGradient>
  );
}
