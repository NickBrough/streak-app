import React from "react";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Home, Clock, Users, Settings } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#20e5e5",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 8,
          height: 60,
          paddingBottom: 4,
          backgroundColor: "transparent",
          borderTopColor: "transparent",
        },
        tabBarBackground: () => (
          <BlurView
            intensity={25}
            tint="dark"
            style={{ flex: 1, borderRadius: 18, overflow: "hidden" }}
          />
        ),
        tabBarItemStyle: { paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: "#0b0f14" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
