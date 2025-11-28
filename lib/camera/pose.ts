export type Landmark = { x: number; y: number; z?: number; score?: number };
export type Pose = { landmarks: Record<string, Landmark> };

export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag1 = Math.hypot(abx, aby);
  const mag2 = Math.hypot(cbx, cby);
  if (mag1 === 0 || mag2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function smooth(value: number, prev: number, alpha = 0.2) {
  return prev + alpha * (value - prev);
}

export function confidenceOK(landmarks: Landmark[], minScore = 0.5) {
  return landmarks.every((l) => (l?.score ?? 1) >= minScore);
}
