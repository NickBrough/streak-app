import { useCallback, useMemo } from "react";
import { runOnJS } from "react-native-reanimated";
import { Pose } from "@/lib/camera/pose";

export function usePoseFrame(onPose: (pose: Pose) => void) {
  const onPoseJS = useCallback(
    (pose: Pose) => {
      if (__DEV__) {
        // Lightweight debug log so we can confirm when ML Kit is actually
        // returning poses into JS.
        // eslint-disable-next-line no-console
        console.log("[PoseFrame] Received pose from frame processor", {
          landmarkKeys: Object.keys(pose.landmarks ?? {}),
        });
      }
      onPose(pose);
    },
    [onPose]
  );

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
      if (proxy) {
        // VisionCamera v4+: prefer initFrameProcessorPlugin if available
        if (typeof proxy.initFrameProcessorPlugin === "function") {
          const plugin = proxy.initFrameProcessorPlugin("detectPose", {});
          if (plugin && typeof plugin.call === "function") {
            posePlugin = (frame: unknown) =>
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              plugin.call(frame);
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.log(
                "[PoseFrame] detectPose frame processor plugin resolved via initFrameProcessorPlugin"
              );
            }
          } else if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log(
              "[PoseFrame] initFrameProcessorPlugin('detectPose') did not return a callable plugin"
            );
          }
        }
        // Fallback for older VisionCamera versions
        if (
          !posePlugin &&
          typeof proxy.getFrameProcessorPlugin === "function"
        ) {
          const legacy = proxy.getFrameProcessorPlugin("detectPose", {});
          if (typeof legacy === "function") {
            posePlugin = legacy as (frame: unknown) => unknown;
            if (__DEV__) {
              // eslint-disable-next-line no-console
              console.log(
                "[PoseFrame] detectPose frame processor plugin resolved via getFrameProcessorPlugin"
              );
            }
          } else if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log(
              "[PoseFrame] detectPose frame processor plugin not a function (legacy path)"
            );
          }
        }
        if (__DEV__ && !posePlugin) {
          // eslint-disable-next-line no-console
          console.log(
            "[PoseFrame] VisionCameraProxy present but no detectPose plugin available"
          );
        }
      } else if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log("[PoseFrame] VisionCameraProxy not available");
      }
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log(
          "[PoseFrame] Error resolving detectPose frame processor plugin",
          error
        );
      }
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




