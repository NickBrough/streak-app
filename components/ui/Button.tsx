import React from "react";
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from "react-native";

type ButtonVariant = "primary" | "outline";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  style?: ViewStyle | ViewStyle[];
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  style,
}: ButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.base, isPrimary ? styles.primary : styles.outline, style]}
    >
      <Text
        style={[
          styles.text,
          isPrimary ? styles.textPrimary : styles.textOutline,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: "#20e5e5",
    shadowColor: "#20e5e5",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  text: { fontSize: 16, fontWeight: "700" },
  textPrimary: { color: "#06121a" },
  textOutline: { color: "#e6f0f2" },
});
