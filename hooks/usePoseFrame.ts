import { useCallback, useMemo } from "react";
import { runOnJS } from "react-native-reanimated";
import { Pose } from "@/lib/camera/pose";

// Ambient global for a native pose detector plugin if present
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any;

export function usePoseFrame(onPose: (pose: Pose) => void) {
  const onPoseJS = useCallback((pose: Pose) => onPose(pose), [onPose]);

  // Provide a stable worklet that VisionCamera can call when available.
  // This avoids importing VisionCamera hooks so Expo Go doesn't break.
  const frameProcessor = useMemo(() => {
    return (frame: unknown) => {
      "worklet";
      // Expected native plugin shape: global.__pose?.detect(frame)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const detector = global?.__pose?.detect;
      if (!detector) return;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = detector(frame);
      if (result) {
        runOnJS(onPoseJS)(result as Pose);
      }
    };
  }, [onPoseJS]);

  return frameProcessor as unknown as (frame: unknown) => void;
}
