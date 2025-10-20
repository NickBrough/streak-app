import { Landmark, Pose, angleDeg, confidenceOK } from "../pose";

export type PushupMode = "side" | "front";

export class PushupDetector {
  private state: "up" | "down" = "up";
  private reps = 0;
  constructor(private mode: PushupMode = "side") {}

  step(pose: Pose): { reps: number; didRep: boolean; confidence: number } {
    const lm = pose.landmarks;
    const leftElbow = lm["left_elbow"] as Landmark;
    const leftShoulder = lm["left_shoulder"] as Landmark;
    const leftWrist = lm["left_wrist"] as Landmark;
    const rightElbow = lm["right_elbow"] as Landmark;
    const rightShoulder = lm["right_shoulder"] as Landmark;
    const rightWrist = lm["right_wrist"] as Landmark;
    const nose = lm["nose"] as Landmark;

    let confidence = 0.0;
    let didRep = false;

    if (this.mode === "side") {
      // Use the more confident side if available
      const leftConfOK = confidenceOK([leftElbow, leftShoulder, leftWrist]);
      const rightConfOK = confidenceOK([rightElbow, rightShoulder, rightWrist]);
      if (!leftConfOK && !rightConfOK)
        return { reps: this.reps, didRep, confidence };
      const elbow = leftConfOK ? leftElbow : rightElbow;
      const shoulder = leftConfOK ? leftShoulder : rightShoulder;
      const wrist = leftConfOK ? leftWrist : rightWrist;
      const elbowAngle = angleDeg(shoulder, elbow, wrist);
      confidence = 0.7;
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
      if (!leftConfOK) return { reps: this.reps, didRep, confidence };
      const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const noseY = nose.y;
      confidence = 0.6;
      if (this.state === "up" && noseY > shoulderY + 0.06) {
        this.state = "down";
      } else if (this.state === "down" && noseY < shoulderY - 0.02) {
        this.state = "up";
        this.reps += 1;
        didRep = true;
      }
    }
    return { reps: this.reps, didRep, confidence };
  }
}
