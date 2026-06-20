// Shared types between server and client
// These types describe the Colyseus room state and messages

export type RaceClass = "D" | "C" | "B" | "A" | "S" | "open";

export type RoomStatus = "lobby" | "countdown" | "racing" | "ended";

export type LobbyPlayer = {
  sessionId: string;
  walletAddress: string;
  selectedCarId: string;
  carName: string;
  carClass: RaceClass;
  powerRating: number;
  ready: boolean;
  joinedAt: number;
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
