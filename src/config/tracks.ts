export type TrackConfig = {
  id: string;
  name: string;
  description: string;
  lapCount: number;
  modelUrl: string;
  isStarter: boolean;
  isFree: boolean;
};

export const CITY_LOOP_TRACK: TrackConfig = {
  id: "city-loop",
  name: "City Loop",
  description: "Free starter street circuit for early garage-to-race testing.",
  lapCount: 2,
  modelUrl: "/models/tracks/city-loop.glb",
  isStarter: true,
  isFree: true,
};

export const TRACKS = [CITY_LOOP_TRACK] as const;
