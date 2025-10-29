import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useMotionDetector } from "@/hooks/useMotionDetector";
import Button from "@/components/ui/Button";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import Constants from "expo-constants";
import { usePoseDetector } from "@/hooks/usePoseDetector";
import { usePoseFrame } from "@/hooks/usePoseFrame";
import { toLocalDayUtcKey } from "@/lib/date";

export default function WorkoutScreen() {
  const { exerciseId } = useLocalSearchParams<{
    exerciseId: "pushup" | "squat";
  }>();
  const [repCount, setRepCount] = useState(0);
  const { user, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const isExpoGo = Constants.appOwnership === "expo";
  const canUseCamera = true;

  const { isActive, startDetection, stopDetection } = useMotionDetector({
    exerciseType: exerciseId ?? "pushup",
    onRepDetected: () => setRepCount((p) => p + 1),
  });

  // Camera pose detector
  const detector = useMemo(() => {
    if (exerciseId === "squat") return { type: "squat" } as const;
    return { type: "pushup" as const, mode: "ground" as const };
  }, [exerciseId]);
  const {
    reps: camReps,
    confidence,
    onPose,
    addManual,
  } = usePoseDetector(detector);
  const [useCameraMode] = useState<boolean>(canUseCamera);
  const [vc, setVc] = useState<any>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [cameraDevice, setCameraDevice] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const frameProcessor = usePoseFrame(onPose);

  useEffect(() => {
    if (loading || !user || sessionId) return;
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_id: user.id, mode: useCameraMode ? "camera" : "motion" })
        .select()
        .single();
      if (!error && data && mounted) {
        setSessionId(data.id);
        if (!useCameraMode) startDetection();
      }
    })();
    return () => {
      mounted = false;
      if (!useCameraMode) stopDetection();
    };
  }, [user, loading, sessionId, useCameraMode]);

  // Load VisionCamera (not on Expo Go), request permission, and resolve a device
  useEffect(() => {
    if (!useCameraMode) return;
    if (isExpoGo) {
      setCameraError("Camera mode not allowed on your device");
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("react-native-vision-camera");
      setVc(mod);
      (async () => {
        try {
          if (mod?.Camera) {
            const status = await mod.Camera.requestCameraPermission();
            const granted = status === "granted";
            setAuthorized(granted);
            if (granted) {
              const list = await mod.Camera.getAvailableCameraDevices();
              const chosen =
                list?.find((d: any) => d.position === "front") ??
                list?.find((d: any) => d.position === "back") ??
                null;
              if (chosen) {
                setCameraDevice(chosen);
              } else {
                setCameraError("Camera mode not allowed on your device");
              }
            } else {
              setCameraError("Camera mode not allowed on your device");
              return;
            }
          }
        } catch {
          setCameraError("Camera mode not allowed on your device");
        }
      })();
    } catch {
      setCameraError("Camera mode not allowed on your device");
    }
  }, [useCameraMode, isExpoGo]);

  // Show popup when camera error occurs
  useEffect(() => {
    if (!cameraError) return;
    Alert.alert("Camera unavailable", cameraError, [{ text: "OK" }]);
  }, [cameraError]);

  return (
    <View style={styles.container}>
      {useCameraMode &&
      vc?.Camera &&
      cameraDevice &&
      authorized &&
      !cameraError ? (
        <vc.Camera
          style={StyleSheet.absoluteFill}
          device={cameraDevice}
          isActive
          frameProcessor={frameProcessor}
          frameProcessorFps={24}
        />
      ) : null}
      {/* Confetti when goal hit */}
      {(() => {
        const n = useCameraMode ? camReps : repCount;
        return n > 0 && n % 10 === 0;
      })() && (
        <ConfettiCannon count={120} origin={{ x: 0, y: 0 }} fadeOut autoStart />
      )}
      <Text style={styles.title}>{exerciseId?.toUpperCase()}</Text>
      <Text style={styles.counter}>{useCameraMode ? camReps : repCount}</Text>
      <Text style={styles.caption}>
        {(() => {
          if (useCameraMode) {
            return confidence > 0.5 ? "Tracking…" : "Finding…";
          }
          return isActive ? "Listening…" : "Paused";
        })()}
      </Text>
      {useCameraMode && (
        <View style={{ position: "absolute", top: 20, right: 20 }}>
          {/* subtle mini progress ring and reps */}
          <View style={{ opacity: 0.9 }}>
            {/* reuse overlay component for consistency */}
          </View>
        </View>
      )}

      {/* Subtle manual correction controls (always available) */}
      <View style={{ height: 20 }} />
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
            if (useCameraMode) addManual(-1);
            else setRepCount((p) => Math.max(0, p - 1));
          }}
        >
          <Text style={styles.circleText}>-1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circleBtnLarge, { backgroundColor: "#20e5e5" }]}
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            if (useCameraMode) addManual(1);
            else setRepCount((p) => p + 1);
          }}
        >
          <Text style={[styles.circleTextLarge, { color: "#06121a" }]}>+1</Text>
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
            if (useCameraMode) addManual(5);
            else setRepCount((p) => p + 5);
          }}
        >
          <Text style={styles.circleText}>+5</Text>
        </TouchableOpacity>
      </View>

      {!useCameraMode && (
        <>
          <View style={{ height: 16 }} />
          <Button
            title={isActive ? "Pause Auto" : "Resume Auto"}
            variant="outline"
            onPress={() => (isActive ? stopDetection() : startDetection())}
          />
        </>
      )}
      <View style={{ height: 12 }} />
      <Button
        title="End Workout"
        onPress={async () => {
          if (!useCameraMode) stopDetection();
          if (user && sessionId && exerciseId) {
            try {
              console.log("ending session", sessionId);
              await supabase
                .from("sessions")
                .update({ ended_at: new Date().toISOString() })
                .eq("id", sessionId);

              console.log(
                "inserting session_reps",
                sessionId,
                exerciseId,
                repCount
              );
              await supabase.from("session_reps").insert({
                session_id: sessionId,
                exercise_id: exerciseId,
                count: useCameraMode ? camReps : repCount,
              });

              const today = toLocalDayUtcKey();
              console.log("today", today);
              const { data: existing } = await supabase
                .from("daily_totals")
                .select("id,totals")
                .eq("user_id", user.id)
                .eq("date", today)
                .maybeSingle();

              console.log("existing", existing);
              const currentTotals: any = existing?.totals ?? {
                pushup: 0,
                squat: 0,
              };
              currentTotals[exerciseId] =
                (currentTotals[exerciseId] ?? 0) +
                (useCameraMode ? camReps : repCount);

              console.log("currentTotals", currentTotals);
              // compute met_goal from exercises
              const { data: exData } = await supabase
                .from("exercises")
                .select("exercise_id,daily_goal")
                .eq("user_id", user.id)
                .eq("enabled", true);
              console.log("exData", exData);
              const metGoal = (exData ?? []).every(
                (e) =>
                  (currentTotals[e.exercise_id] ?? 0) >= (e.daily_goal ?? 0)
              );

              console.log("metGoal", metGoal);
              if (existing) {
                await supabase
                  .from("daily_totals")
                  .update({ totals: currentTotals, met_goal: metGoal })
                  .eq("id", existing.id);
                console.log("updated daily_totals", existing.id);
              } else {
                console.log(
                  "inserting daily_totals",
                  user.id,
                  today,
                  currentTotals,
                  metGoal,
                  1
                );
                await supabase.from("daily_totals").insert({
                  user_id: user.id,
                  date: today,
                  totals: currentTotals,
                  met_goal: metGoal,
                  streak: 1,
                });
              }
            } catch (error) {
              console.error("error", error);
            }
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
