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
        try {
          subscriptionRef.current.remove();
        } catch (error) {
          // Ignore errors when removing subscription
        }
        subscriptionRef.current = null;
      }
      return;
    }

    // Ensure Accelerometer module is available before using it
    if (!Accelerometer || typeof Accelerometer.setUpdateInterval !== "function") {
      console.warn("Accelerometer module not available");
      return;
    }

    try {
      Accelerometer.setUpdateInterval(100);
    } catch (error) {
      console.error("Failed to set accelerometer update interval:", error);
      return;
    }

    try {
      subscriptionRef.current = Accelerometer.addListener(({ z }) => {
        try {
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
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch (hapticError) {
                // Ignore haptic errors
              }
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
              try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch (hapticError) {
                // Ignore haptic errors
              }
              onRepDetected();
            }
          }
        } catch (error) {
          // Ignore errors in listener callback to prevent crashes
          console.error("Error in accelerometer listener:", error);
        }
      });
    } catch (error) {
      console.error("Failed to add accelerometer listener:", error);
      return;
    }

    return () => {
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.remove();
        } catch (error) {
          // Ignore errors when removing subscription
        }
      }
    };
  }, [isActive, exerciseType, onRepDetected]);

  const startDetection = async () => {
    try {
      if (!Accelerometer || typeof Accelerometer.requestPermissionsAsync !== "function") {
        console.warn("Accelerometer module not available");
        return;
      }
      const { status } = await Accelerometer.requestPermissionsAsync();
      if (status === "granted") {
        setIsActive(true);
        stateRef.current = "waiting";
      }
    } catch (error) {
      console.error("Failed to start motion detection:", error);
    }
  };

  const stopDetection = () => {
    setIsActive(false);
    stateRef.current = "waiting";
  };

  return { isActive, startDetection, stopDetection };
}
