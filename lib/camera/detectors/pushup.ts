import { Landmark, Pose, angleDeg, confidenceOK } from "../pose";

export type PushupMode = "ground" | "side" | "front";

export class PushupDetector {
  private state: "up" | "down" = "up";
  private reps = 0;
  private minEyeDist = Number.POSITIVE_INFINITY;
  private maxEyeDist = 0;
  constructor(private mode: PushupMode = "ground") {}

  step(pose: Pose): {
    reps: number;
    didRep: boolean;
    confidence: number;
    progress: number;
  } {
    const lm = pose.landmarks;
    const leftElbow = lm["left_elbow"] as Landmark;
    const leftShoulder = lm["left_shoulder"] as Landmark;
    const leftWrist = lm["left_wrist"] as Landmark;
    const rightElbow = lm["right_elbow"] as Landmark;
    const rightShoulder = lm["right_shoulder"] as Landmark;
    const rightWrist = lm["right_wrist"] as Landmark;
    const nose = lm["nose"] as Landmark;
    const leftEye = lm["left_eye"] as Landmark;
    const rightEye = lm["right_eye"] as Landmark;

    let confidence = 0.0;
    let didRep = false;
    let progress = 0;

    if (this.mode === "ground") {
      // Phone on ground under face: use inter-eye distance as proximity proxy
      if (!confidenceOK([leftEye, rightEye, nose]))
        return { reps: this.reps, didRep, confidence, progress: 0 };
      const dx = (leftEye?.x ?? 0) - (rightEye?.x ?? 0);
      const dy = (leftEye?.y ?? 0) - (rightEye?.y ?? 0);
      const eyeDist = Math.hypot(dx, dy);
      if (isFinite(eyeDist) && eyeDist > 0) {
        this.minEyeDist = Math.min(this.minEyeDist, eyeDist);
        this.maxEyeDist = Math.max(this.maxEyeDist, eyeDist);
      }
      const span = Math.max(1e-4, this.maxEyeDist - this.minEyeDist);
      progress = Math.max(0, Math.min(1, (eyeDist - this.minEyeDist) / span));
      confidence = 0.7;
      if (this.state === "up" && progress > 0.7) {
        this.state = "down";
      } else if (this.state === "down" && progress < 0.3) {
        this.state = "up";
        this.reps += 1;
        didRep = true;
      }
    } else if (this.mode === "side") {
      // Use the more confident side if available
      const leftConfOK = confidenceOK([leftElbow, leftShoulder, leftWrist]);
      const rightConfOK = confidenceOK([rightElbow, rightShoulder, rightWrist]);
      if (!leftConfOK && !rightConfOK)
        return { reps: this.reps, didRep, confidence, progress: 0 };
      const elbow = leftConfOK ? leftElbow : rightElbow;
      const shoulder = leftConfOK ? leftShoulder : rightShoulder;
      const wrist = leftConfOK ? leftWrist : rightWrist;
      const elbowAngle = angleDeg(shoulder, elbow, wrist);
      confidence = 0.7;
      // Map elbow angle 150° (top) -> 0, 70° (bottom) -> 1
      progress = Math.max(0, Math.min(1, (150 - elbowAngle) / (150 - 70)));
      if (this.state === "up" && elbowAngle < 70) {
        this.state = "down";
      } else if (this.state === "down" && elbowAngle > 150) {
        this.state = "up";
        this.reps += 1;
        didRep = true;
      }
    } else {
      // front mode: approximate using nose vertical oscillation vs shoulders
      const leftConfOK = confidenceOK([leftShoulder, rightShoulder, nose]);
      if (!leftConfOK)
        return { reps: this.reps, didRep, confidence, progress: 0 };
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const noseY = nose.y;
      confidence = 0.6;
      // Map nose relative to shoulders: 0.02 -> 0, 0.06 -> 1
      const delta = noseY - shoulderY;
      progress = Math.max(0, Math.min(1, (delta - 0.02) / (0.06 - 0.02)));
      if (this.state === "up" && noseY > shoulderY + 0.06) {
        this.state = "down";
      } else if (this.state === "down" && noseY < shoulderY - 0.02) {
        this.state = "up";
        this.reps += 1;
        didRep = true;
      }
    }
    return { reps: this.reps, didRep, confidence, progress };
  }
}
