import { useCallback, useMemo } from "react";
import { runOnJS } from "react-native-reanimated";
import { Pose } from "@/lib/camera/pose";

export function usePoseFrame(onPose: (pose: Pose) => void) {
  const onPoseJS = useCallback((pose: Pose) => onPose(pose), [onPose]);

  // Provide a stable worklet that VisionCamera can call when available.
  // This avoids importing VisionCamera hooks directly so Expo Go doesn't break.
  const frameProcessor = useMemo(() => {
    // Resolve the VisionCamera frame processor plugin on the JS side.
    // We do this outside the worklet and close over the plugin function.
    // If the native plugin or VisionCamera module isn't available
    // (e.g. Expo Go, Android without plugin), this will safely be null.
    let posePlugin: ((frame: unknown) => unknown) | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const vc = require("react-native-vision-camera");
      const proxy = vc?.VisionCameraProxy;
      if (proxy && typeof proxy.getFrameProcessorPlugin === "function") {
        const plugin = proxy.getFrameProcessorPlugin("detectPose", {});
        if (typeof plugin === "function") {
          posePlugin = plugin as (frame: unknown) => unknown;
        }
      }
    } catch {
      // Swallow module resolution errors (e.g. Expo Go, missing native bits)
      posePlugin = null;
    }

    return (frame: unknown) => {
      "worklet";
      try {
        if (!frame) return;
        // posePlugin is closed over from JS; if it's null, no-op.
        if (!posePlugin) return;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const result = posePlugin(frame);
        if (result) {
          runOnJS(onPoseJS)(result as Pose);
        }
      } catch {
        // Silently ignore errors in frame processor to prevent crashes.
        // If the native plugin isn't registered, this will simply no-op.
      }
    };
  }, [onPoseJS]);

  return frameProcessor as unknown as (frame: unknown) => void;
}
