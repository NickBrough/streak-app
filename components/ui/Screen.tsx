import React, { ReactNode } from "react";
import { View, ScrollView, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export default function Screen({
  children,
  scroll,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const containerPadTop = insets.top + 16;

  const Background = (
    <>
      <View style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["#071018", "#06121f", "#051826"]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );

  if (scroll) {
    return (
      <View style={styles.root}>
        {Background}
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: containerPadTop },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {Background}
      <View
        style={[styles.content, { paddingTop: containerPadTop }, contentStyle]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#04080d" },
  content: { paddingHorizontal: 20, paddingBottom: 120, minHeight: "100%" },
});
