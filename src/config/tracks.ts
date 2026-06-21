/**
 * A single checkpoint on a track.
 * Checkpoints are arranged in `order` starting at 0 (start/finish line).
 */
export type CheckpointConfig = {
  id: string;
  order: number;
  x: number;
  z: number;
  radius: number;
  label?: string;
  /** True if this checkpoint is also the start/finish line. */
  isFinish?: boolean;
};

export type TrackConfig = {
  id: string;
  name: string;
  description: string;
  lapCount: number;
  modelUrl: string;
  isStarter: boolean;
  isFree: boolean;
  /** Spawn point for the local car. */
  startPosition: { x: number; y: number; z: number; yaw: number };
  /** Ordered checkpoints. index 0 must be the start/finish line. */
  checkpoints: CheckpointConfig[];
};

const CITY_LOOP_CHECKPOINTS: CheckpointConfig[] = [
  { id: "cp-start", order: 0, x: 0, z: -80, radius: 24, label: "Start / Finish", isFinish: true },
  { id: "cp-north", order: 1, x: 0, z: 200, radius: 28, label: "North Straight" },
  { id: "cp-northeast", order: 2, x: 120, z: 340, radius: 28, label: "Northeast Curve" },
  { id: "cp-east", order: 3, x: 320, z: 260, radius: 28, label: "East Bend" },
  { id: "cp-southeast", order: 4, x: 380, z: 0, radius: 28, label: "Southeast Straight" },
  { id: "cp-south", order: 5, x: 340, z: -120, radius: 28, label: "South Curve" },
  { id: "cp-southwest", order: 6, x: 260, z: -220, radius: 28, label: "Southwest Curve" },
  { id: "cp-west-return", order: 7, x: 140, z: -260, radius: 28, label: "West Return" },
  { id: "cp-west", order: 8, x: -80, z: -180, radius: 28, label: "West Curve" },
  { id: "cp-return", order: 9, x: -80, z: 0, radius: 28, label: "Return Straight" },
];

export const CITY_LOOP_TRACK: TrackConfig = {
  id: "city-loop",
  name: "City Loop",
  description: "Free starter street circuit for early garage-to-race testing.",
  lapCount: 3,
  modelUrl: "/models/tracks/city-loop.glb",
  isStarter: true,
  isFree: true,
  startPosition: { x: 0, y: 0.3, z: -80, yaw: 0 },
  checkpoints: CITY_LOOP_CHECKPOINTS,
};

export const TRACKS = [CITY_LOOP_TRACK] as const;
