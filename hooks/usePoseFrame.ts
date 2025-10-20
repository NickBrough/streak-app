import { useCallback } from "react";
import { useFrameProcessor } from "react-native-vision-camera";
import { runOnJS } from "react-native-reanimated";
import { Pose } from "@/lib/camera/pose";

// Ambient global for a native pose detector plugin if present
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any;

export function usePoseFrame(onPose: (pose: Pose) => void) {
  const onPoseJS = useCallback((pose: Pose) => onPose(pose), [onPose]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";
      // If a native plugin is available, call it here.
      // Expected shape: global.__pose?.detect(frame) -> { landmarks: { name: {x,y,score} } }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const detector = global && global.__pose && global.__pose.detect;
      if (detector) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const result = detector(frame);
        if (result) {
          // @ts-expect-error runOnJS is only available in worklets
          runOnJS(onPoseJS)(result as Pose);
        }
      }
    },
    [onPoseJS]
  );

  return frameProcessor;
}
