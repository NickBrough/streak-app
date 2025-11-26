export type Landmark = { x: number; y: number; z?: number; score?: number };
export type Pose = { landmarks: Record<string, Landmark> };

// Helper to adapt pose data from the v3 pose-detection plugin callback into
// our internal Pose shape. The plugin already returns normalized coordinates
// and landmark keys that match our detector expectations, so we mostly just
// enforce the Landmark typing here.
export function fromPluginPose(
  pluginPose: any | null | undefined
): Pose | null {
  if (!pluginPose || typeof pluginPose !== "object") return null;
  const raw = (pluginPose as any).landmarks ?? pluginPose;
  if (!raw || typeof raw !== "object") return null;
  const landmarks: Record<string, Landmark> = {};
  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    if (!value || typeof value !== "object") continue;
    const x = Number((value as any).x);
    const y = Number((value as any).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const z = (value as any).z;
    const score = (value as any).score ?? (value as any).confidence;
    landmarks[key] = {
      x,
      y,
      z: Number.isFinite(Number(z)) ? Number(z) : undefined,
      score: Number.isFinite(Number(score)) ? Number(score) : undefined,
    };
  }
  if (!Object.keys(landmarks).length) return null;
  return { landmarks };
}

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
