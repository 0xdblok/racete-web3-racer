/**
 * Racete Multiplayer Client
 *
 * Thin wrapper around colyseus.js for matchmaking and room lifecycle.
 * Singleton client — one Colyseus connection per browser tab.
 */

import type { Client, Room } from "colyseus.js";
import type { RaceRoomState, LobbyPlayer, RoomStatus } from "@/types/multiplayer";
import { publicEnv } from "@/lib/env";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type { RaceRoomState, LobbyPlayer, RoomStatus };

export type MultiplayerMovementPayload = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  isNitro: boolean;
  isDrifting: boolean;
  sentAt?: number;
};

export type MatchmakingStatus =
  | "idle"
  | "connecting"
  | "searching"
  | "joined"
  | "error"
  | "disconnected";

export type MatchmakingState = {
  status: MatchmakingStatus;
  room: RaceRoomState | null;
  roomId: string | null;
  sessionId: string | null;
  error: string | null;
};

type Listener = () => void;

/* ------------------------------------------------------------------ */
/*  Server URL resolution                                              */
/* ------------------------------------------------------------------ */

function getConfiguredServerUrl(): string | null {
  if (publicEnv.gameServerUrl) return publicEnv.gameServerUrl;
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const port = "2567";
    return `${protocol}//${window.location.hostname}:${port}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Singleton client                                                    */
/* ------------------------------------------------------------------ */

let _client: Client | null = null;

async function getClient(): Promise<Client> {
  if (!_client) {
    const url = getConfiguredServerUrl();
    if (!url) {
      throw new Error("Game server URL is not configured. Set NEXT_PUBLIC_GAME_SERVER_URL.");
    }
    const colyseus = (await import("colyseus.js")) as unknown as { Client: new (url: string) => Client };
    _client = new colyseus.Client(url);
  }
  return _client;
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let _room: Room<RaceRoomState> | null = null;
const _listeners: Set<Listener> = new Set();
let _state: MatchmakingState = {
  status: "idle",
  room: null,
  roomId: null,
  sessionId: null,
  error: null,
};

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export function getState(): MatchmakingState {
  return { ..._state };
}

export function subscribe(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function emit() {
  _listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // never let listener errors kill the room
    }
  });
}

function setState(patch: Partial<MatchmakingState>) {
  _state = { ..._state, ...patch };
  emit();
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Convert a car class like "B" or "S" to a room name.
 * Falls back to "race_open".
 */
function classToRoomName(carClass: string): string {
  const cls = carClass.toUpperCase();
  if (["D", "C", "B", "A", "S"].includes(cls)) {
    return `race_${cls}`;
  }
  return "race_open";
}

export async function findMatch(params: {
  walletAddress: string;
  selectedCarId: string;
  carName: string;
  carClass: string;
  powerRating: number;
}): Promise<void> {
  if (_state.status === "searching" || _state.status === "joined") {
    return; // already in matchmaking
  }

  setState({ status: "connecting", error: null });

  try {
    const client = await getClient();
    const roomName = classToRoomName(params.carClass);

    // joinOrCreate: either join an existing room for this class, or create one
    const room = await client.joinOrCreate<RaceRoomState>(roomName, {
      walletAddress: params.walletAddress,
      selectedCarId: params.selectedCarId,
      carName: params.carName,
      carClass: params.carClass,
      powerRating: params.powerRating,
    });

    _room = room;
    const roomIdentifier = (room as unknown as { id: string }).id;
    setState({
      status: "searching",
      roomId: roomIdentifier,
      sessionId: room.sessionId,
    });

    // Watch for state changes from the server
    room.onStateChange((state) => {
      const players: LobbyPlayer[] = state.players
        ? Array.from(state.players).map((p: unknown) => p as LobbyPlayer)
        : [];

      setState({
        room: {
          roomId: state.roomId || roomIdentifier,
          status: (state.status as RoomStatus) || "lobby",
          raceClass: (state.raceClass as RaceRoomState["raceClass"]) || "open",
          players,
          countdownSeconds: state.countdownSeconds ?? 5,
          countdownStartedAt: state.countdownStartedAt ?? null,
          raceStartedAt: state.raceStartedAt ?? null,
          maxPlayers: state.maxPlayers ?? 4,
          minPlayersToStart: state.minPlayersToStart ?? 2,
        },
        status:
          state.status === "racing"
            ? "joined"
            : state.status === "ended"
              ? "joined"
              : "searching",
      });
    });

    // Handle messages from server
    room.onMessage("joined", (msg: { sessionId: string; existing: boolean }) => {
      setState({ sessionId: msg.sessionId });
    });

    room.onMessage("error", (msg: { message: string }) => {
      setState({ error: msg.message });
    });

    // Handle disconnect
    room.onLeave((code) => {
      console.log(`[Multiplayer] Left room (code ${code})`);
      _room = null;
      setState({
        status: "disconnected",
        room: null,
        roomId: null,
        sessionId: null,
        error: code !== 1000 ? "Disconnected from game server" : null,
      });
    });

    // Send join message (in case server expects explicit join)
    room.send("join", {
      walletAddress: params.walletAddress,
      selectedCarId: params.selectedCarId,
      carName: params.carName,
      carClass: params.carClass,
      powerRating: params.powerRating,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not connect to game server";
    setState({ status: "error", error: message });
  }
}

export function toggleReady(ready: boolean): void {
  if (!_room) return;
  _room.send("ready", { ready });
}

export function sendMovement(payload: MultiplayerMovementPayload): void {
  if (!_room) return;
  _room.send("movement", { ...payload, sentAt: payload.sentAt ?? Date.now() });
}

export function cancelMatchmaking(): void {
  if (_room) {
    _room.leave(true);
    _room = null;
  }
  setState({
    status: "idle",
    room: null,
    roomId: null,
    sessionId: null,
    error: null,
  });
}

export function getRoom(): Room<RaceRoomState> | null {
  return _room;
}
