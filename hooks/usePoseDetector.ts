import { useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { PushupDetector, PushupMode } from "@/lib/camera/detectors/pushup";
import { SquatDetector } from "@/lib/camera/detectors/squat";
import { Pose } from "@/lib/camera/pose";

export type DetectorType =
  | { type: "pushup"; mode: PushupMode }
  | { type: "squat" };

export function usePoseDetector(det: DetectorType) {
  const [reps, setReps] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [progress, setProgress] = useState(0);
  const pushRef = useRef<PushupDetector>();
  const squatRef = useRef<SquatDetector>();

  useEffect(() => {
    if (det.type === "pushup") pushRef.current = new PushupDetector(det.mode);
    if (det.type === "squat") squatRef.current = new SquatDetector();
    setReps(0);
    setConfidence(0);
  }, [det.type, det.type === "pushup" ? det.mode : undefined]);

  function onPose(pose: Pose) {
    let res;
    if (det.type === "pushup" && pushRef.current)
      res = pushRef.current.step(pose);
    if (det.type === "squat" && squatRef.current)
      res = squatRef.current.step(pose);
    if (!res) return;
    setConfidence(res.confidence);
    if (typeof (res as any).progress === "number")
      setProgress((res as any).progress);
    if (res.didRep) {
      setReps(res.reps);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        // Ignore haptic errors
      }
    }
  }

  function addManual(delta: number) {
    setReps((prev) => Math.max(0, prev + delta));
  }

  return { reps, confidence, progress, onPose, addManual };
}
