// Shared types between server and client
// These types describe the Colyseus room state and messages

export type RaceClass = "D" | "C" | "B" | "A" | "S" | "open";

export type RoomStatus = "lobby" | "countdown" | "racing" | "finished";

export type PlayerRaceStatus = "lobby" | "racing" | "finished" | "disconnected" | "dnf" | "disqualified";

export type LobbyPlayer = {
  sessionId: string;
  walletAddress: string;
  selectedCarId: string;
  carName: string;
  carClass: RaceClass;
  powerRating: number;
  ready: boolean;
  joinedAt: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  isNitro: boolean;
  isDrifting: boolean;
  raceStatus: PlayerRaceStatus;
  laneIndex: number;
  lastUpdate: number;
  // Server-authoritative race progress
  currentLap: number;
  totalLaps: number;
  checkpointIndex: number;
  checkpointsPassed: number;
  startedAt: number;
  finishedAt: number;
  totalTimeMs: number;
  bestLapMs: number;
  firstLapMs: number;
  placement: number;
  // Anti-cheat tracking
  suspiciousEvents: number;
  speedViolations: number;
  teleportViolations: number;
  checkpointViolations: number;
  outOfOrderViolations: number;
  acFlagReason: string;
};

export type RaceResultEntry = {
  sessionId: string;
  walletAddress: string;
  displayWallet: string;
  carName: string;
  carClass: string;
  placement: number;
  totalTimeMs: number;
  bestLapMs: number;
  firstLapMs: number;
  status: "finished" | "dnf" | "disconnected" | "disqualified";
};

export type RaceRoomState = {
  roomId: string;
  status: RoomStatus;
  raceClass: RaceClass;
  players: LobbyPlayer[];
  countdownSeconds: number;
  countdownStartedAt: number | null;
  raceStartedAt: number | null;
  maxPlayers: number;
  minPlayersToStart: number;
  results: RaceResultEntry[];
};

export type ClientJoinMessage = {
  walletAddress: string;
  selectedCarId: string;
  carName: string;
  carClass: string;
  powerRating: number;
};

export type ClientReadyMessage = {
  ready: boolean;
};

export type ClientMovementMessage = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  isNitro: boolean;
  isDrifting: boolean;
  sentAt?: number;
};

export type ClientCheckpointMessage = {
  checkpointId: string;
};

export type ClientFinishMessage = {
  totalTimeMs?: number;
  bestLapMs?: number;
  firstLapMs?: number;
};

export const ROOM_NAMES = {
  raceRoom: "race_room",
} as const;

export const ROOM_PREFIXES: Record<RaceClass, string> = {
  D: "race_D",
  C: "race_C",
  B: "race_B",
  A: "race_A",
  S: "race_S",
  open: "race_open",
};
