import React from "react";
import { TextInput, StyleSheet, TextInputProps } from "react-native";

export default function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#64748b"
      autoCapitalize="none"
      style={styles.input}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    color: "#e6f0f2",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
