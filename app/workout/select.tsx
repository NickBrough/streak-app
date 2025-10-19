import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Button from "@/components/ui/Button";
import { router } from "expo-router";

export default function WorkoutSelect() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Exercise</Text>
      <View style={{ height: 12 }} />
      <Button title="Push-Ups" onPress={() => router.push("/workout/pushup")} />
      <View style={{ height: 12 }} />
      <Button
        title="Squats"
        variant="outline"
        onPress={() => router.push("/workout/squat")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#04080d",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    color: "#e6f0f2",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
  },
});
