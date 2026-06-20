// Shared multiplayer types (used by both client lib and UI components)
// These mirror the server types but without Colyseus Schema dependencies.

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
