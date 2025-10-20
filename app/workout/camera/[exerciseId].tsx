import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, Text, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
// VisionCamera is dynamically required to avoid crashing in Expo Go
import PoseOverlay from "@/components/camera/PoseOverlay";
import { usePoseDetector } from "@/hooks/usePoseDetector";
import { usePoseFrame } from "@/hooks/usePoseFrame";
import Button from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import * as Device from "expo-device";
import Constants from "expo-constants";

export default function CameraWorkoutScreen() {
  const { exerciseId } = useLocalSearchParams<{
    exerciseId: "pushup" | "squat";
  }>();
  const isExpoGo = Constants.appOwnership === "expo";
  const [vc, setVc] = useState<any>(null);
  useEffect(() => {
    if (isExpoGo) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("react-native-vision-camera");
      setVc(mod);
    } catch (e) {
      setVc(null);
    }
  }, [isExpoGo]);
  const devices = vc?.useCameraDevices ? vc.useCameraDevices() : undefined;
  const device = devices?.back ?? devices?.front;
  const camRef = useRef<any>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const { user, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const detector = useMemo(() => {
    if (exerciseId === "squat") return { type: "squat" } as const;
    return { type: "pushup", mode: "side" as const };
  }, [exerciseId]);
  const { reps, confidence, onPose } = usePoseDetector(detector);
  const frameProcessor = usePoseFrame(onPose);
  const lastGoodTsRef = useRef<number>(Date.now());
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    (async () => {
      if (!vc?.Camera) return;
      const status = await vc.Camera.requestCameraPermission();
      setAuthorized(status === "granted");
    })();
  }, []);

  // Create a camera-mode session once user is available
  useEffect(() => {
    if (loading || !user || sessionId) return;
    (async () => {
      const { data, error } = await supabase
        .from("sessions")
        .insert({ user_id: user.id, mode: "camera" })
        .select()
        .single();
      if (!error && data) setSessionId(data.id);
    })();
  }, [user, loading, sessionId]);

  // Monitor confidence to suggest motion fallback
  useEffect(() => {
    const now = Date.now();
    if ((confidence ?? 0) > 0.5) {
      lastGoodTsRef.current = now;
      if (showFallback) setShowFallback(false);
    } else if (now - lastGoodTsRef.current > 4000 && !showFallback) {
      setShowFallback(true);
    }
  }, [confidence, showFallback]);

  return (
    <View style={styles.root}>
      {Platform.OS === "ios" && !Device.isDevice ? (
        <View style={styles.simWrap}>
          <Text style={styles.simText}>
            Camera is not supported on the iOS Simulator. Please use a real
            device.
          </Text>
          <View style={{ height: 12 }} />
          <Button
            title="Back"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      ) : isExpoGo ? (
        <View style={styles.simWrap}>
          <Text style={styles.simText}>
            Camera requires a development build. Please run a dev client (expo
            run:ios / run:android).
          </Text>
          <View style={{ height: 12 }} />
          <Button
            title="Back"
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      ) : device && authorized && vc?.Camera ? (
        <vc.Camera
          ref={camRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          frameProcessor={frameProcessor}
          frameProcessorFps={24}
        />
      ) : null}
      <PoseOverlay tracking={(confidence ?? 0) > 0.5} reps={reps} />
      {showFallback && (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            Low camera confidence. Switch to Motion tracking?
          </Text>
          <View style={{ height: 8 }} />
          <Button
            title="Switch to Motion"
            variant="outline"
            onPress={() => router.replace(`/workout/${exerciseId}`)}
          />
        </View>
      )}
      <View style={styles.footer}>
        <Button
          title="End"
          onPress={async () => {
            if (user && sessionId && exerciseId) {
              try {
                await supabase
                  .from("sessions")
                  .update({ ended_at: new Date().toISOString() })
                  .eq("id", sessionId);

                await supabase.from("session_reps").insert({
                  session_id: sessionId,
                  exercise_id: exerciseId,
                  count: reps,
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
                  (currentTotals[exerciseId] ?? 0) + reps;

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
              } catch (e) {
                console.error("camera end workout error", e);
              }
            }
            router.back();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  footer: { position: "absolute", bottom: 24, left: 20, right: 20 },
  simWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  simText: { color: "#e6f0f2", textAlign: "center" },
  fallback: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 100,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    padding: 12,
  },
  fallbackText: { color: "#e6f0f2", textAlign: "center" },
});
