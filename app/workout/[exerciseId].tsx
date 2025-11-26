import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMotionDetector } from "@/hooks/useMotionDetector";
import Button from "@/components/ui/Button";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { logError, logMessage } from "@/lib/sentry";
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import Constants from "expo-constants";
import { usePoseDetector } from "@/hooks/usePoseDetector";
import { toLocalDayUtcKey } from "@/lib/date";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import PoseOverlay from "@/components/camera/PoseOverlay";
import { Camera as PoseCamera } from "react-native-vision-camera-v3-pose-detection";
import { fromPluginPose } from "@/lib/camera/pose";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function WorkoutScreen() {
  const { exerciseId } = useLocalSearchParams<{
    exerciseId: "pushup" | "squat";
  }>();
  const [repCount, setRepCount] = useState(0);
  const { user, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const isExpoGo = Constants.appOwnership === "expo";
  const canUseCamera = true;
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [todayBaseCount, setTodayBaseCount] = useState<number>(0);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [goalCelebrated, setGoalCelebrated] = useState(false);

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
    confidence: poseConfidence,
    progress: poseProgress,
    onPose,
    addManual,
  } = usePoseDetector(detector);
  const [useCameraMode] = useState<boolean>(canUseCamera);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [cameraDevice, setCameraDevice] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [poseDetectorReady, setPoseDetectorReady] = useState(false);
  const glowPulse = useRef(new Animated.Value(0)).current;
  const glowAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const insets = useSafeAreaInsets();

  // Mark pose detector as "ready" once the camera itself is ready.
  // The native frame processor plugin is injected by VisionCamera; if it
  // isn't available, the worklet will safely no-op.
  useEffect(() => {
    if (!useCameraMode) {
      setPoseDetectorReady(false);
      return;
    }
    const ready =
      Boolean(cameraDevice) && authorized === true && !cameraError;
    setPoseDetectorReady(ready);
  }, [useCameraMode, vc, cameraDevice, authorized, cameraError]);

  useEffect(() => {
    if (loading || !user || sessionId) return;
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .insert({
            user_id: user.id,
            mode: useCameraMode ? "camera" : "motion",
          })
          .select()
          .single();
        if (error) {
          logError(error, {
            screen: "workout",
            phase: "create_session",
          });
        }
        if (!error && data && mounted) {
          setSessionId(data.id);
          if (!useCameraMode) startDetection();
        }
      } catch (error) {
        logError(error, { screen: "workout", phase: "create_session_catch" });
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
      if (!mod || !mod.Camera) {
        setCameraError("Camera module not available");
        return;
      }
      (async () => {
        try {
          // Check if Camera methods exist before calling
          if (
            mod?.Camera &&
            typeof mod.Camera.requestCameraPermission === "function" &&
            typeof mod.Camera.getAvailableCameraDevices === "function"
          ) {
            const status = await mod.Camera.requestCameraPermission();
            const granted = status === "granted";
            setAuthorized(granted);
            if (granted) {
              const list = await mod.Camera.getAvailableCameraDevices();
              if (Array.isArray(list) && list.length > 0) {
                const chosen =
                  list.find((d: any) => d?.position === "front") ??
                  list.find((d: any) => d?.position === "back") ??
                  null;
                if (chosen) {
                  setCameraDevice(chosen);
                } else {
                  setCameraError("No suitable camera device found");
                }
              } else {
                setCameraError("No camera devices available");
              }
            } else {
              setCameraError("Camera permission denied");
              return;
            }
          } else {
            setCameraError("Camera module not properly initialized");
          }
        } catch (error) {
          console.error("Camera initialization error:", error);
          setCameraError("Failed to initialize camera");
        }
      })();
    } catch (error) {
      console.error("Failed to load camera module:", error);
      setCameraError("Camera module not available");
    }
  }, [useCameraMode, isExpoGo]);

  // Show popup when camera error occurs
  useEffect(() => {
    if (!cameraError) return;
    Alert.alert("Camera unavailable", cameraError, [{ text: "OK" }]);
  }, [cameraError]);

  // Load daily goal and today's base totals for this exercise
  useEffect(() => {
    if (loading || !user || !exerciseId) return;
    let mounted = true;
    (async () => {
      try {
        const { data: exRow, error: exError } = await supabase
          .from("exercises")
          .select("daily_goal")
          .eq("user_id", user.id)
          .eq("exercise_id", exerciseId)
          .eq("enabled", true)
          .maybeSingle();
        if (exError) {
          logError(exError, {
            screen: "workout",
            phase: "load_goal",
          });
        }
        const defaultGoals: Record<"pushup" | "squat", number> = {
          pushup: 30,
          squat: 20,
        };
        const fallback = defaultGoals[exerciseId] ?? 25;
        const goal = Math.max(0, exRow?.daily_goal ?? fallback);
        const today = toLocalDayUtcKey();
        const { data: totalsRow, error: totalsError } = await supabase
          .from("daily_totals")
          .select("totals")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();
        if (totalsError) {
          logError(totalsError, {
            screen: "workout",
            phase: "load_today_totals",
          });
        }
        const base = Math.max(0, totalsRow?.totals?.[exerciseId] ?? 0);
        if (!mounted) return;
        setDailyGoal(goal);
        setTodayBaseCount(base);
        setGoalLoaded(true);
      } catch (error) {
        if (!mounted) return;
        logError(error, { screen: "workout", phase: "load_goal_catch" });
        // Soft-fallbacks
        setDailyGoal(exerciseId === "pushup" ? 30 : 20);
        setTodayBaseCount(0);
        setGoalLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, loading, exerciseId]);

  const sessionReps = useCameraMode ? camReps : repCount;
  const projectedTotal = todayBaseCount + sessionReps;
  const progressToGoal =
    dailyGoal && dailyGoal > 0
      ? Math.max(0, Math.min(1, projectedTotal / dailyGoal))
      : 0;
  const goalMet =
    goalLoaded && dailyGoal !== null && projectedTotal >= dailyGoal;
  // Celebrate once when crossing the daily goal threshold
  useEffect(() => {
    if (!goalLoaded || goalCelebrated || !dailyGoal || dailyGoal <= 0) return;
    if (projectedTotal >= dailyGoal) {
      setGoalCelebrated(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        // Ignore haptic errors
      }
    }
  }, [goalLoaded, dailyGoal, projectedTotal, goalCelebrated]);

  // Subtle pulsing when goal is met
  useEffect(() => {
    if (goalMet) {
      glowAnimRef.current?.stop?.();
      glowPulse.setValue(0);
      const a = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(glowPulse, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ])
      );
      glowAnimRef.current = a;
      a.start();
    } else {
      glowAnimRef.current?.stop?.();
      glowPulse.setValue(0);
    }
    return () => {
      glowAnimRef.current?.stop?.();
    };
  }, [goalMet]);

  const tracking =
    useCameraMode && poseDetectorReady && poseConfidence >= 0.5;
  return (
    <View style={styles.container}>
      {useCameraMode &&
      cameraDevice &&
      authorized &&
      !cameraError &&
      poseDetectorReady ? (
        <PoseCamera
          style={StyleSheet.absoluteFill}
          device={cameraDevice}
          isActive
          options={{
            mode: "stream",
            performanceMode: "max",
          }}
          callback={(pluginPose: any) => {
            const pose = fromPluginPose(pluginPose);
            if (pose) {
              onPose(pose);
            }
          }}
        />
      ) : null}
      {useCameraMode && cameraDevice && authorized && !cameraError ? (
        <PoseOverlay
          tracking={tracking}
          reps={camReps}
          progress={poseProgress}
        />
      ) : null}
      {/* Confetti when goal hit */}
      {(() => {
        const n = useCameraMode ? camReps : repCount;
        if (goalCelebrated) {
          return (
            <ConfettiCannon
              count={300}
              origin={{ x: 0, y: 0 }}
              fadeOut
              autoStart
            />
          );
        }
        if (n > 0 && n % 10 === 0) {
          const confettiCount = Math.max(50, Math.min(500, n * 5));
          return (
            <ConfettiCannon
              count={confettiCount}
              origin={{ x: 0, y: 0 }}
              fadeOut
              autoStart
            />
          );
        }
        return null;
      })()}
      <Text style={styles.title}>{exerciseId?.toUpperCase()}</Text>
      {/* Minimal daily total chip for the current exercise */}
      <View
        style={[
          styles.todayRow,
          { position: "absolute", top: insets.top + 12, right: 16, zIndex: 5 },
        ]}
      >
        <View style={styles.todayChip}>
          <View style={styles.todayIconWrap}>
            <Text style={styles.todayIcon}>
              {exerciseId === "pushup" ? "💪" : "🦵"}
            </Text>
          </View>
          <View>
            <Text style={styles.todayLabel}>Today</Text>
            <Text style={styles.todayValue}>
              {todayBaseCount + (useCameraMode ? camReps : repCount)}
            </Text>
          </View>
        </View>
      </View>
      {/* Center counter with Revolut-style progress ring */}
      <View style={styles.centerCounterWrap}>
        {goalLoaded && dailyGoal !== null ? (
          <Svg width={220} height={220}>
            <Defs>
              <LinearGradient id="goalGradMain" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#20e5e5" stopOpacity="1" />
                <Stop offset="100%" stopColor="#57ffa6" stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="fireGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#ff8a00" stopOpacity="1" />
                <Stop offset="100%" stopColor="#ff3d81" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            {/* Base track */}
            <Circle
              cx={110}
              cy={110}
              r={94}
              stroke="#0b1620"
              strokeWidth={12}
              fill="none"
            />
            {/* Soft aura for progress */}
            {!goalMet && (
              <Circle
                cx={110}
                cy={110}
                r={94}
                stroke="#20e5e5"
                strokeOpacity={0.15}
                strokeWidth={18}
                strokeDasharray={`${
                  2 * Math.PI * 94 * Math.max(0, Math.min(1, progressToGoal))
                } ${2 * Math.PI * 94}`}
                strokeLinecap="round"
                rotation={-90}
                originX={110}
                originY={110}
                fill="none"
              />
            )}
            {/* Foreground progress */}
            <Circle
              cx={110}
              cy={110}
              r={94}
              stroke={goalMet ? "url(#fireGrad)" : "url(#goalGradMain)"}
              strokeWidth={12}
              strokeDasharray={`${
                2 * Math.PI * 94 * Math.max(0, Math.min(1, progressToGoal))
              } ${2 * Math.PI * 94}`}
              strokeLinecap="round"
              rotation={-90}
              originX={110}
              originY={110}
              fill="none"
            />
            {goalMet && (
              <>
                <AnimatedCircle
                  cx={110}
                  cy={110}
                  r={94}
                  stroke="url(#fireGrad)"
                  strokeOpacity={
                    glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.14, 0.26],
                    }) as unknown as number
                  }
                  strokeWidth={
                    glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 30],
                    }) as unknown as number
                  }
                  fill="none"
                />
                <AnimatedCircle
                  cx={110}
                  cy={110}
                  r={94}
                  stroke="url(#fireGrad)"
                  strokeOpacity={
                    glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.1, 0.18],
                    }) as unknown as number
                  }
                  strokeWidth={
                    glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 22],
                    }) as unknown as number
                  }
                  fill="none"
                />
              </>
            )}
          </Svg>
        ) : null}
        <View style={styles.centerLabel}>
          <Text style={[styles.counter, goalMet && styles.counterOnFire]}>
            {useCameraMode ? camReps : repCount}
          </Text>
        </View>
        {goalMet && (
          <Animated.View
            style={[
              styles.fireBadge,
              {
                transform: [
                  {
                    scale: glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.fireBadgeText}>🔥</Text>
          </Animated.View>
        )}
      </View>

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
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
              // Ignore haptic errors
            }
            if (useCameraMode) addManual(-1);
            else setRepCount((p) => Math.max(0, p - 1));
          }}
        >
          <Text style={styles.circleText}>-1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circleBtnLarge, { backgroundColor: "#20e5e5" }]}
          onPress={async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch (error) {
              // Ignore haptic errors
            }
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
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (error) {
              // Ignore haptic errors
            }
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
              await supabase
                .from("sessions")
                .update({ ended_at: new Date().toISOString() })
                .eq("id", sessionId);

              await supabase.from("session_reps").insert({
                session_id: sessionId,
                exercise_id: exerciseId,
                count: useCameraMode ? camReps : repCount,
              });

              const today = toLocalDayUtcKey();
              const { data: existing, error: existingError } = await supabase
                .from("daily_totals")
                .select("id,totals")
                .eq("user_id", user.id)
                .eq("date", today)
                .maybeSingle();
              if (existingError) {
                logError(existingError, {
                  screen: "workout",
                  phase: "load_daily_totals",
                });
              }

              const currentTotals: any = existing?.totals ?? {
                pushup: 0,
                squat: 0,
              };
              currentTotals[exerciseId] =
                (currentTotals[exerciseId] ?? 0) +
                (useCameraMode ? camReps : repCount);

              // compute met_goal from exercises
              const { data: exData, error: exError } = await supabase
                .from("exercises")
                .select("exercise_id,daily_goal")
                .eq("user_id", user.id)
                .eq("enabled", true);
              if (exError) {
                logError(exError, {
                  screen: "workout",
                  phase: "load_exercises_for_met_goal",
                });
              }

              const metGoal = (exData ?? []).every(
                (e) =>
                  (currentTotals[e.exercise_id] ?? 0) >= (e.daily_goal ?? 0)
              );

              if (existing) {
                const { error: updateError } = await supabase
                  .from("daily_totals")
                  .update({ totals: currentTotals, met_goal: metGoal })
                  .eq("id", existing.id);
                if (updateError) {
                  logError(updateError, {
                    screen: "workout",
                    phase: "update_daily_totals",
                  });
                }
              } else {
                const { error: insertError } = await supabase
                  .from("daily_totals")
                  .insert({
                    user_id: user.id,
                    date: today,
                    totals: currentTotals,
                    met_goal: metGoal,
                    streak: 1,
                  });
                if (insertError) {
                  logError(insertError, {
                    screen: "workout",
                    phase: "insert_daily_totals",
                  });
                }
              }

              logMessage("Workout session ended", {
                screen: "workout",
                sessionId,
                exerciseId,
                reps: useCameraMode ? camReps : repCount,
                metGoal,
              });
            } catch (error) {
              logError(error, { screen: "workout", phase: "end_workout" });
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
  todayRow: {
    width: "100%",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 8,
  },
  todayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 32, 0.7)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
  },
  todayIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  todayIcon: { fontSize: 16 },
  todayLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  todayValue: {
    color: "#e6f0f2",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  centerCounterWrap: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 4,
  },
  centerLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    color: "#e6f0f2",
    fontSize: 80,
    fontWeight: "800",
    textShadowColor: "rgba(32,229,229,0.4)",
    textShadowRadius: 24,
  },
  counterOnFire: {
    textShadowColor: "rgba(255,122,0,0.6)",
    textShadowRadius: 28,
  },
  caption: { color: "#94a3b8", marginTop: 6 },
  fireBadge: {
    position: "absolute",
    top: -6,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,138,0,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  fireBadgeText: {
    fontSize: 18,
  },
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
