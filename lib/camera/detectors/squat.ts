import { Pose, angleDeg, confidenceOK } from "../pose";

export class SquatDetector {
  private state: "up" | "down" = "up";
  private reps = 0;

  step(pose: Pose): { reps: number; didRep: boolean; confidence: number } {
    const lm = pose.landmarks;
    const hip = lm["left_hip"] ?? lm["right_hip"];
    const knee = lm["left_knee"] ?? lm["right_knee"];
    const ankle = lm["left_ankle"] ?? lm["right_ankle"];
    if (!confidenceOK([hip, knee, ankle] as any))
      return { reps: this.reps, didRep: false, confidence: 0 };

    const kneeAngle = angleDeg(hip, knee, ankle);
    let didRep = false;
    let confidence = 0.7;

    if (this.state === "up" && kneeAngle < 80) {
      this.state = "down";
    } else if (this.state === "down" && kneeAngle > 160) {
      this.state = "up";
      this.reps += 1;
      didRep = true;
    }
    return { reps: this.reps, didRep, confidence };
  }
}
