// Shared multiplayer types (used by both client lib and UI components)
// These mirror the server types but without Colyseus Schema dependencies.

export type RaceClass = "D" | "C" | "B" | "A" | "S" | "open";

export type RoomStatus = "lobby" | "countdown" | "racing" | "finished";

export type PlayerRaceStatus = "lobby" | "racing" | "finished" | "disconnected" | "dnf";

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
  status: "finished" | "dnf";
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
