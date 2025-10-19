import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";
import * as Haptics from "expo-haptics";

interface MotionDetectorConfig {
  exerciseType: "pushup" | "squat";
  onRepDetected: () => void;
}

export function useMotionDetector({
  exerciseType,
  onRepDetected,
}: MotionDetectorConfig) {
  const [isActive, setIsActive] = useState(false);
  const stateRef = useRef<"waiting" | "down" | "up">("waiting");
  const lastRepTimeRef = useRef(0);
  const subscriptionRef = useRef<ReturnType<
    typeof Accelerometer.addListener
  > | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      return;
    }

    Accelerometer.setUpdateInterval(100);

    subscriptionRef.current = Accelerometer.addListener(({ z }) => {
      const now = Date.now();
      const timeSinceLastRep = now - lastRepTimeRef.current;
      const MIN_REP_TIME = 500;
      if (timeSinceLastRep < MIN_REP_TIME) return;

      if (exerciseType === "pushup") {
        const DOWN_THRESHOLD = -0.2;
        const UP_THRESHOLD = 0.2;
        if (stateRef.current === "waiting" && z < DOWN_THRESHOLD) {
          stateRef.current = "down";
        } else if (stateRef.current === "down" && z > UP_THRESHOLD) {
          stateRef.current = "waiting";
          lastRepTimeRef.current = now;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onRepDetected();
        }
      }

      if (exerciseType === "squat") {
        const DOWN_THRESHOLD = -0.3;
        const UP_THRESHOLD = 0.3;
        if (stateRef.current === "waiting" && z < DOWN_THRESHOLD) {
          stateRef.current = "down";
        } else if (stateRef.current === "down" && z > UP_THRESHOLD) {
          stateRef.current = "waiting";
          lastRepTimeRef.current = now;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onRepDetected();
        }
      }
    });

    return () => {
      if (subscriptionRef.current) subscriptionRef.current.remove();
    };
  }, [isActive, exerciseType, onRepDetected]);

  const startDetection = async () => {
    const { status } = await Accelerometer.requestPermissionsAsync();
    if (status === "granted") {
      setIsActive(true);
      stateRef.current = "waiting";
    }
  };

  const stopDetection = () => {
    setIsActive(false);
    stateRef.current = "waiting";
  };

  return { isActive, startDetection, stopDetection };
}
