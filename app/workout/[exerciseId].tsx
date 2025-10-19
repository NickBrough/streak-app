import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMotionDetector } from "@/hooks/useMotionDetector";
import Button from "@/components/ui/Button";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import * as Haptics from "expo-haptics";

export default function WorkoutScreen() {
  const { exerciseId } = useLocalSearchParams<{
    exerciseId: "pushup" | "squat";
  }>();
  const [repCount, setRepCount] = useState(0);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { isActive, startDetection, stopDetection } = useMotionDetector({
    exerciseType: exerciseId ?? "pushup",
    onRepDetected: () => setRepCount((p) => p + 1),
  });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_id: user.id, mode: "motion" })
        .select()
        .single();
      if (!error && data) setSessionId(data.id);
      if (mode === "auto") startDetection();
    })();
    return () => stopDetection();
  }, []);

  useEffect(() => {
    if (mode === "auto") {
      startDetection();
    } else {
      stopDetection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{exerciseId?.toUpperCase()}</Text>

      {/* Mode toggle */}
      <View style={styles.segment}>
        <TouchableOpacity
          onPress={() => setMode("auto")}
          style={[
            styles.segmentBtn,
            mode === "auto" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "auto" && styles.segmentTextActive,
            ]}
          >
            Auto
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMode("manual")}
          style={[
            styles.segmentBtn,
            mode === "manual" && styles.segmentBtnActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              mode === "manual" && styles.segmentTextActive,
            ]}
          >
            Manual
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.counter}>{repCount}</Text>
      <Text style={styles.caption}>
        {mode === "auto"
          ? isActive
            ? "Listening…"
            : "Paused"
          : "Manual entry"}
      </Text>

      {mode === "auto" ? (
        <>
          <View style={{ height: 20 }} />
          <Button
            title={isActive ? "Pause" : "Resume"}
            variant="outline"
            onPress={() => (isActive ? stopDetection() : startDetection())}
          />
        </>
      ) : (
        <>
          <View style={{ height: 28 }} />
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[
                styles.circleBtn,
                {
                  backgroundColor: "#10202a",
                  borderColor: "rgba(255,255,255,0.08)",
                },
              ]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRepCount((p) => Math.max(0, p - 1));
              }}
            >
              <Text style={styles.circleText}>-1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circleBtnLarge, { backgroundColor: "#20e5e5" }]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setRepCount((p) => p + 1);
              }}
            >
              <Text style={[styles.circleTextLarge, { color: "#06121a" }]}>
                +1
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.circleBtn,
                {
                  backgroundColor: "#10202a",
                  borderColor: "rgba(255,255,255,0.08)",
                },
              ]}
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setRepCount((p) => p + 5);
              }}
            >
              <Text style={styles.circleText}>+5</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      <View style={{ height: 12 }} />
      <Button
        title="End Workout"
        onPress={async () => {
          stopDetection();
          if (user && sessionId && exerciseId) {
            try {
              await supabase
                .from("sessions")
                .update({ ended_at: new Date().toISOString() })
                .eq("id", sessionId);

              await supabase.from("session_reps").insert({
                session_id: sessionId,
                exercise_id: exerciseId,
                count: repCount,
              });

              const today = new Date().toISOString().split("T")[0];
              const { data: existing } = await supabase
                .from("daily_totals")
                .select("id,totals")
                .eq("user_id", user.id)
                .eq("date", today)
                .maybeSingle();

              const currentTotals: any = existing?.totals ?? {
                pushup: 0,
                squat: 0,
              };
              currentTotals[exerciseId] =
                (currentTotals[exerciseId] ?? 0) + repCount;

              // compute met_goal from exercises
              const { data: exData } = await supabase
                .from("exercises")
                .select("exercise_id,daily_goal")
                .eq("user_id", user.id)
                .eq("enabled", true);
              const metGoal = (exData ?? []).every(
                (e) =>
                  (currentTotals[e.exercise_id] ?? 0) >= (e.daily_goal ?? 0)
              );

              if (existing) {
                await supabase
                  .from("daily_totals")
                  .update({ totals: currentTotals, met_goal: metGoal })
                  .eq("id", existing.id);
              } else {
                await supabase.from("daily_totals").insert({
                  user_id: user.id,
                  date: today,
                  totals: currentTotals,
                  met_goal: metGoal,
                  streak: 1,
                });
              }
            } catch {}
          }
          router.replace("/");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#04080d",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: { color: "#94a3b8", fontSize: 14, letterSpacing: 2 },
  counter: {
    color: "#e6f0f2",
    fontSize: 80,
    fontWeight: "800",
    textShadowColor: "rgba(32,229,229,0.4)",
    textShadowRadius: 24,
  },
  caption: { color: "#94a3b8", marginTop: 6 },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 4,
    marginTop: 8,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: "#0f1720" },
  segmentText: { color: "#94a3b8", fontWeight: "600" },
  segmentTextActive: { color: "#e6f0f2" },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  circleBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  circleBtnLarge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#20e5e5",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  circleText: { color: "#e6f0f2", fontSize: 20, fontWeight: "800" },
  circleTextLarge: { fontSize: 28, fontWeight: "900" },
});
