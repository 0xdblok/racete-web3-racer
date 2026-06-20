import { Room, Client } from "colyseus";
import { RaceStateSchema, LobbyPlayerSchema } from "../schema/RaceState";
import type { ClientJoinMessage, ClientReadyMessage, ClientMovementMessage, RaceClass } from "../types";

const SPAWN_LANES = [
  { x: -4, z: -80 },
  { x: 4, z: -86 },
  { x: -8, z: -92 },
  { x: 8, z: -98 },
  { x: -12, z: -104 },
  { x: 12, z: -110 },
];

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export class RaceRoom extends Room<RaceStateSchema> {
  override onCreate(options: { raceClass: RaceClass }) {
    const raceClass = options.raceClass || "open";

    this.setState(new RaceStateSchema());
    this.state.roomId = this.roomId;
    this.state.raceClass = raceClass;
    this.state.status = "lobby";
    this.state.maxPlayers = 6;
    this.state.minPlayersToStart = 2;
    this.state.countdownSeconds = 5;

    // When a client sends "join" message with car/player info
    this.onMessage("join", (client, message: ClientJoinMessage) => {
      this.handleJoin(client, message);
    });

    // When a client toggles ready state
    this.onMessage("ready", (client, message: ClientReadyMessage) => {
      this.handleReady(client, message);
    });

    // When a client sends car transform updates during racing
    this.onMessage("movement", (client, message: ClientMovementMessage) => {
      this.handleMovement(client, message);
    });

    console.log(`[RaceRoom] Created room ${this.roomId} for class ${raceClass}`);
  }

  override onJoin(client: Client, options?: ClientJoinMessage) {
    console.log(`[RaceRoom] Client ${client.sessionId} joined. Waiting for "join" message with player info.`);

    // Client connected — wait for "join" message with player data
    // If options were passed through joinOrCreate, handle them
    if (options?.walletAddress) {
      this.addPlayer(client, options);
    }
  }

  override onLeave(client: Client) {
    console.log(`[RaceRoom] Player left: ${client.sessionId}`);

    // Remove player from state
    const idx = this.state.players.findIndex((p) => p.sessionId === client.sessionId);
    if (idx !== -1) {
      this.state.players.splice(idx, 1);
    }

    // If racing and room is empty, dispose
    if (this.state.players.length === 0) {
      if (this.state.status === "racing" || this.state.status === "ended") {
        this.disconnect();
      }
    }

    // If countdown was started and we're below min, cancel countdown
    if (this.state.status === "countdown" && this.state.players.length < this.state.minPlayersToStart) {
      this.cancelCountdown();
    }
  }

  override onDispose() {
    console.log(`[RaceRoom] Room ${this.roomId} disposed.`);
  }

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                           */
  /* ------------------------------------------------------------------ */

  private handleJoin(client: Client, message: ClientJoinMessage) {
    if (!message.walletAddress) {
      client.send("error", { message: "walletAddress is required" });
      return;
    }

    // Check if already in room (rejoin prevention)
    const existing = this.state.players.find((p) => p.walletAddress === message.walletAddress);
    if (existing) {
      // Update session ID (reconnect)
      existing.sessionId = client.sessionId;
      client.send("joined", { sessionId: client.sessionId, existing: true });
      return;
    }

    if (this.state.players.length >= this.state.maxPlayers) {
      client.send("error", { message: "Room is full" });
      return;
    }

    if (this.state.status !== "lobby") {
      client.send("error", { message: "Race already started" });
      return;
    }

    this.addPlayer(client, message);
  }

  private handleReady(client: Client, message: ClientReadyMessage) {
    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) {
      client.send("error", { message: "Player not found in room" });
      return;
    }

    player.ready = message.ready;

    // Check if all ready players meet the minimum to start
    const readyPlayers = this.state.players.filter((p) => p.ready);
    if (readyPlayers.length >= this.state.minPlayersToStart && this.state.status === "lobby") {
      this.startCountdown();
    } else if (readyPlayers.length < this.state.minPlayersToStart && this.state.status === "countdown") {
      this.cancelCountdown();
    }
  }

  private handleMovement(client: Client, message: ClientMovementMessage) {
    if (this.state.status !== "racing") return;

    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) return;

    player.x = clampFinite(message.x, -520, 520, player.x);
    player.y = clampFinite(message.y, -20, 40, player.y);
    player.z = clampFinite(message.z, -520, 520, player.z);
    player.yaw = clampFinite(message.yaw, -Math.PI * 4, Math.PI * 4, player.yaw);
    player.speed = clampFinite(message.speed, -250, 350, player.speed);
    player.isNitro = Boolean(message.isNitro);
    player.isDrifting = Boolean(message.isDrifting);
    player.raceStatus = "racing";
    player.lastUpdate = Date.now();
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                    */
  /* ------------------------------------------------------------------ */

  private addPlayer(client: Client, data: ClientJoinMessage) {
    const player = new LobbyPlayerSchema();
    player.sessionId = client.sessionId;
    player.walletAddress = data.walletAddress;
    player.selectedCarId = data.selectedCarId || "";
    player.carName = data.carName || "Unknown Car";
    player.carClass = (data.carClass as RaceClass) || "open";
    player.powerRating = data.powerRating || 0;
    player.ready = false;
    player.joinedAt = Date.now();
    player.laneIndex = this.state.players.length;
    const spawn = SPAWN_LANES[player.laneIndex % SPAWN_LANES.length];
    player.x = spawn.x;
    player.y = 0.3;
    player.z = spawn.z;
    player.yaw = 0;
    player.speed = 0;
    player.isNitro = false;
    player.isDrifting = false;
    player.raceStatus = "lobby";
    player.lastUpdate = Date.now();

    this.state.players.push(player);
    client.send("joined", { sessionId: client.sessionId, existing: false });
    console.log(`[RaceRoom] Player added: ${data.walletAddress} (${data.carName})`);
  }

  private countdownTimer?: ReturnType<typeof setTimeout>;

  private startCountdown() {
    if (this.state.status !== "lobby") return;

    this.state.status = "countdown";
    this.state.countdownSeconds = 5;
    this.state.countdownStartedAt = Date.now();

    console.log(`[RaceRoom ${this.roomId}] Countdown started!`);

    // Decrement every second
    let remaining = 5;
    this.countdownTimer = setInterval(() => {
      remaining--;
      this.state.countdownSeconds = remaining;

      if (remaining <= 0) {
        this.startRace();
      }
    }, 1000);
  }

  private cancelCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
    this.state.status = "lobby";
    this.state.countdownSeconds = 5;
    this.state.countdownStartedAt = 0;
    console.log(`[RaceRoom ${this.roomId}] Countdown cancelled.`);
  }

  private startRace() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
    this.state.status = "racing";
    this.state.raceStartedAt = Date.now();
    this.state.countdownSeconds = 0;

    this.state.players.forEach((player, index) => {
      const spawn = SPAWN_LANES[index % SPAWN_LANES.length];
      player.laneIndex = index;
      player.x = spawn.x;
      player.y = 0.3;
      player.z = spawn.z;
      player.yaw = 0;
      player.speed = 0;
      player.isNitro = false;
      player.isDrifting = false;
      player.raceStatus = "racing";
      player.lastUpdate = Date.now();
    });

    console.log(`[RaceRoom ${this.roomId}] Race started! ${this.state.players.length} racers.`);
  }
}
