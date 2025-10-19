import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import { router } from "expo-router";
import StreakDisplay from "@/components/StreakDisplay";
import ExerciseCard from "@/components/ExerciseCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<
    {
      id: string;
      name: string;
      goal: number;
      emoji: string;
      exercise_id: "pushup" | "squat";
    }[]
  >([]);
  const [totals, setTotals] = useState<{ [k: string]: number }>({
    pushup: 0,
    squat: 0,
  });
  const [last7Days, setLast7Days] = useState<boolean[]>(
    new Array(7).fill(false)
  );
  const [streak, setStreak] = useState(0);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [dayConfetti, setDayConfetti] = useState(false);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const openLauncher = async () => {
    setLauncherOpen(true);
    opacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  const closeLauncher = () => {
    opacity.value = withTiming(0, { duration: 160 });
    translateY.value = withTiming(40, { duration: 160 });
    setTimeout(() => setLauncherOpen(false), 160);
  };
  const startExercise = async (exerciseId: "pushup" | "squat") => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    closeLauncher();
    router.push(`/workout/${exerciseId}`);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: exData } = await supabase
          .from("exercises")
          .select("exercise_id,daily_goal")
          .eq("user_id", user.id)
          .eq("enabled", true);
        const mapped = (exData ?? []).map((e) => ({
          id: e.exercise_id,
          exercise_id: e.exercise_id,
          name: e.exercise_id === "pushup" ? "Push-Ups" : "Squats",
          emoji: e.exercise_id === "pushup" ? "💪" : "🦵",
          goal: e.daily_goal ?? 0,
        }));
        setExercises(mapped);

        const today = new Date().toISOString().split("T")[0];
        const { data: todayData } = await supabase
          .from("daily_totals")
          .select("totals,streak,met_goal")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();
        if (todayData) {
          setTotals(todayData.totals as any);
          setStreak(todayData.streak ?? 0);
          if (todayData.met_goal) setDayConfetti(true);
        } else {
          setTotals({ pushup: 0, squat: 0 });
          setStreak(0);
        }

        const { data: weekData } = await supabase
          .from("daily_totals")
          .select("met_goal,date")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(7);
        const completed = new Array(7).fill(false);
        weekData?.forEach((day, idx) => {
          if (day.met_goal) completed[6 - idx] = true;
        });
        setLast7Days(completed);
      } catch {}
    })();
  }, [user]);

  return (
    <View style={{ flex: 1, backgroundColor: "#04080d" }}>
      <LinearGradient
        colors={["#071018", "#06121f", "#051826"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: 120 },
        ]}
      >
        {dayConfetti && (
          <ConfettiCannon
            count={160}
            origin={{ x: 0, y: 0 }}
            fadeOut
            autoStart
            onAnimationEnd={() => setDayConfetti(false)}
          />
        )}
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetLabel}>Today</Text>
            <Text style={styles.heading}>Keep your streak alive</Text>
          </View>
          <View style={styles.avatarChip} />
        </View>
        <View style={styles.cardGlow}>
          <StreakDisplay days={last7Days} currentStreak={streak} />
        </View>
        <View style={{ height: 12 }} />
        <View style={styles.cardGlass}>
          {exercises.map((ex) => {
            const cur = totals[ex.exercise_id] ?? 0;
            const complete = cur >= ex.goal;
            const anyIncompleteExists = exercises.some(
              (e) => (totals[e.exercise_id] ?? 0) < e.goal
            );
            const highlight = anyIncompleteExists && !complete;
            return (
              <ExerciseCard
                key={ex.id}
                name={ex.name}
                emoji={ex.emoji}
                goal={ex.goal}
                current={cur}
                highlight={highlight}
                onStart={() => startExercise(ex.exercise_id)}
              />
            );
          })}
        </View>
        <View style={{ height: 20 }} />
        <Button title="Start Workout" onPress={openLauncher} />
      </ScrollView>

      {launcherOpen && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.launcherOverlay,
            overlayStyle,
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeLauncher}
          />
          <Animated.View
            style={[
              styles.launcherSheet,
              { paddingBottom: insets.bottom + 80 },
              sheetStyle,
            ]}
          >
            <Text style={styles.launcherTitle}>Choose Workout</Text>
            <View style={{ height: 12 }} />
            <TouchableOpacity
              style={[
                styles.launcherItem,
                { borderColor: "rgba(255,255,255,0.08)" },
              ]}
              onPress={() => startExercise("pushup")}
            >
              <Text style={styles.launcherEmoji}>💪</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.launcherName}>Push-Ups</Text>
                <Text style={styles.launcherSub}>Upper body strength</Text>
              </View>
              <Text style={styles.launcherGo}>Start</Text>
            </TouchableOpacity>
            <View style={{ height: 10 }} />
            <TouchableOpacity
              style={[
                styles.launcherItem,
                { borderColor: "rgba(255,255,255,0.08)" },
              ]}
              onPress={() => startExercise("squat")}
            >
              <Text style={styles.launcherEmoji}>🦵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.launcherName}>Squats</Text>
                <Text style={styles.launcherSub}>Lower body power</Text>
              </View>
              <Text style={styles.launcherGo}>Start</Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    minHeight: "100%",
  },
  heading: {
    color: "#e6f0f2",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  greetLabel: { color: "#94a3b8", fontSize: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  avatarChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardGlow: {
    backgroundColor: "rgba(15, 23, 32, 0.9)",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#00e5e5",
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  cardGlass: {
    backgroundColor: "rgba(15, 23, 32, 0.7)",
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  launcherOverlay: {
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  launcherSheet: {
    backgroundColor: "#0b0f14",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  launcherTitle: { color: "#e6f0f2", fontSize: 18, fontWeight: "700" },
  launcherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  launcherEmoji: { fontSize: 24 },
  launcherName: { color: "#e6f0f2", fontSize: 16, fontWeight: "700" },
  launcherSub: { color: "#94a3b8", fontSize: 12 },
  launcherGo: { color: "#20e5e5", fontWeight: "700" },
});
