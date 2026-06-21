import { Room, Client } from "colyseus";
import { RaceStateSchema, LobbyPlayerSchema, RaceResultSchema } from "../schema/RaceState";
import type { ClientJoinMessage, ClientReadyMessage, ClientMovementMessage, RaceClass } from "../types";

// ── Track config (hardcoded City Loop for V1) ────────────────────────────

const CITY_LOOP_CHECKPOINTS = 10; // 0=start/finish, 1-9=mid-lap checkpoints
const CITY_LOOP_LAPS = 3;
const MAX_RACE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const MIN_FINISH_TIME_MS = 30_000; // 30 seconds minimum

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

function shortWallet(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ── Message types ────────────────────────────────────────────────────────

type CheckpointMessage = { checkpointId: string };
type FinishMessage = { totalTimeMs?: number; bestLapMs?: number; firstLapMs?: number };

export class RaceRoom extends Room<RaceStateSchema> {
  private raceTimer?: ReturnType<typeof setTimeout>;
  private countdownTimer?: ReturnType<typeof setInterval>;
  private nextPlacement = 1;

  override onCreate(options: { raceClass: RaceClass }) {
    const raceClass = options.raceClass || "open";

    this.setState(new RaceStateSchema());
    this.state.roomId = this.roomId;
    this.state.raceClass = raceClass;
    this.state.status = "lobby";
    this.state.maxPlayers = 6;
    this.state.minPlayersToStart = 2;
    this.state.countdownSeconds = 5;

    this.onMessage("join", (client, message: ClientJoinMessage) => {
      this.handleJoin(client, message);
    });

    this.onMessage("ready", (client, message: ClientReadyMessage) => {
      this.handleReady(client, message);
    });

    this.onMessage("movement", (client, message: ClientMovementMessage) => {
      this.handleMovement(client, message);
    });

    // ── Server-authoritative checkpoint + finish ──────────────────────────
    this.onMessage("checkpoint", (client, message: CheckpointMessage) => {
      this.handleCheckpoint(client, message);
    });

    this.onMessage("finish", (client, message: FinishMessage) => {
      this.handleFinish(client, message);
    });

    console.log(`[RaceRoom] Created room ${this.roomId} for class ${raceClass}`);
  }

  override onJoin(client: Client, options?: ClientJoinMessage) {
    console.log(`[RaceRoom] Client ${client.sessionId} joined.`);
    if (options?.walletAddress) {
      this.addPlayer(client, options);
    }
  }

  override onLeave(client: Client) {
    console.log(`[RaceRoom] Player left: ${client.sessionId}`);

    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) return;

    // If racing, mark as DNF
    if (player.raceStatus === "racing") {
      player.raceStatus = "disconnected";
      player.finishedAt = Date.now();
      console.log(`[RaceRoom] Player ${shortWallet(player.walletAddress)} DNF (disconnected during race)`);
      this.broadcast("player_dnf", {
        sessionId: player.sessionId,
        walletAddress: player.walletAddress,
        displayWallet: shortWallet(player.walletAddress),
      });
      this.checkRaceComplete();
    } else {
      // Remove from lobby
      const idx = this.state.players.findIndex((p) => p.sessionId === client.sessionId);
      if (idx !== -1) {
        this.state.players.splice(idx, 1);
      }
    }

    // If empty after cleanup, dispose
    if (this.state.players.length === 0) {
      this.disconnect();
    }

    // Cancel countdown if below min
    if (this.state.status === "countdown" && this.state.players.length < this.state.minPlayersToStart) {
      this.cancelCountdown();
    }
  }

  override onDispose() {
    this.clearTimers();
    console.log(`[RaceRoom] Room ${this.roomId} disposed.`);
  }

  /* ------------------------------------------------------------------ */
  /*  Join / Ready / Movement (mostly unchanged)                         */
  /* ------------------------------------------------------------------ */

  private handleJoin(client: Client, message: ClientJoinMessage) {
    if (!message.walletAddress) {
      client.send("error", { message: "walletAddress is required" });
      return;
    }

    const existing = this.state.players.find((p) => p.walletAddress === message.walletAddress);
    if (existing) {
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
    if (player.raceStatus !== "racing") return;

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
  /*  CHECKPOINT — server-validated sequential order                     */
  /* ------------------------------------------------------------------ */

  private handleCheckpoint(client: Client, message: CheckpointMessage) {
    if (this.state.status !== "racing") return;

    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) return;
    if (player.raceStatus !== "racing") return;

    // Parse checkpoint ID to extract order index
    // Expected format: "cp-X" where X is numeric, matching the order field
    const cpOrder = this.parseCheckpointOrder(message.checkpointId);
    if (cpOrder === null) return; // Invalid ID

    // The next expected checkpoint depends on current checkpointIndex
    // After crossing index 0 (start/finish), we expect index 1 next
    // After crossing indices 1-8, we expect the next index
    // After crossing index 9 (last mid-lap), we expect index 0 again (start/finish)

    const expectedOrder = player.checkpointIndex;

    if (cpOrder !== expectedOrder) {
      // Out of order — ignore silently (client may resend stale events)
      return;
    }

    // Valid checkpoint crossing
    player.checkpointsPassed += 1;

    if (cpOrder === 0) {
      // Start/finish line — lap completed
      const now = Date.now();
      const lapTime = now - player.startedAt; // approximate lap time

      // Track best lap and first lap
      if (player.firstLapMs === 0 && player.currentLap === 1) {
        player.firstLapMs = lapTime;
      }
      // For bestLapMs, use the total from the client via finish for accuracy
      // Here we just track lap completion

      if (player.currentLap >= player.totalLaps) {
        // Don't auto-finish — wait for explicit finish message
        // This is the last lap, checkpointIndex should stay at 0
        player.checkpointIndex = 0;
      } else {
        player.currentLap += 1;
        player.checkpointIndex = 1; // Next expected: first mid-lap checkpoint
      }
    } else if (cpOrder === CITY_LOOP_CHECKPOINTS - 1) {
      // Last mid-lap checkpoint → next is start/finish
      player.checkpointIndex = 0;
    } else {
      player.checkpointIndex = cpOrder + 1;
    }

    // Send confirmation to the client
    client.send("checkpoint_result", {
      valid: true,
      checkpointId: message.checkpointId,
      currentLap: player.currentLap,
      totalLaps: player.totalLaps,
      checkpointIndex: player.checkpointIndex,
      checkpointsPassed: player.checkpointsPassed,
    });
  }

  /** Parse checkpoint ID like "cp-start", "cp-north", etc. into an order index. */
  private parseCheckpointOrder(id: string): number | null {
    // Hardcoded City Loop V1 mapping
    const map: Record<string, number> = {
      "cp-start": 0,
      "cp-north": 1,
      "cp-northeast": 2,
      "cp-east": 3,
      "cp-southeast": 4,
      "cp-south": 5,
      "cp-southwest": 6,
      "cp-west-return": 7,
      "cp-west": 8,
      "cp-return": 9,
    };
    return map[id] ?? null;
  }

  /* ------------------------------------------------------------------ */
  /*  FINISH — server-validated                                          */
  /* ------------------------------------------------------------------ */

  private handleFinish(client: Client, message: FinishMessage) {
    if (this.state.status !== "racing") return;

    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) {
      client.send("finish_result", { accepted: false, error: "Player not found" });
      return;
    }

    // Already finished?
    if (player.raceStatus === "finished") {
      client.send("finish_result", { accepted: false, error: "Already finished" });
      return;
    }

    // Validate laps
    if (player.currentLap < player.totalLaps) {
      client.send("finish_result", {
        accepted: false,
        error: `Not enough laps: ${player.currentLap}/${player.totalLaps}`,
      });
      return;
    }

    // Validate checkpoint order — must be at index 0 (start/finish) for finish
    if (player.checkpointIndex !== 0 && player.checkpointsPassed > 0) {
      client.send("finish_result", {
        accepted: false,
        error: "Must cross start/finish line to complete",
      });
      return;
    }

    // Validate minimum checkpoints
    const minCheckpoints = player.totalLaps * CITY_LOOP_CHECKPOINTS;
    if (player.checkpointsPassed < minCheckpoints) {
      client.send("finish_result", {
        accepted: false,
        error: `Missing checkpoints: ${player.checkpointsPassed}/${minCheckpoints}`,
      });
      return;
    }

    // Compute time
    const now = Date.now();
    const totalTimeMs = now - player.startedAt;

    // Validate finish time plausibility
    if (totalTimeMs < MIN_FINISH_TIME_MS) {
      client.send("finish_result", {
        accepted: false,
        error: "Finish time is impossibly fast",
      });
      return;
    }

    // Accept finish
    player.raceStatus = "finished";
    player.finishedAt = now;
    player.totalTimeMs = totalTimeMs;
    player.bestLapMs = message.bestLapMs ?? player.bestLapMs;
    player.firstLapMs = message.firstLapMs ?? player.firstLapMs;
    player.placement = this.nextPlacement++;

    console.log(
      `[RaceRoom] Player finished: ${shortWallet(player.walletAddress)} ` +
      `Place #${player.placement} Time ${totalTimeMs}ms Laps ${player.currentLap}`,
    );

    // Confirm to the client
    client.send("finish_result", {
      accepted: true,
      placement: player.placement,
      totalTimeMs: player.totalTimeMs,
      bestLapMs: player.bestLapMs,
      firstLapMs: player.firstLapMs,
    });

    // Broadcast to all clients
    this.broadcast("player_finished", {
      sessionId: player.sessionId,
      walletAddress: player.walletAddress,
      displayWallet: shortWallet(player.walletAddress),
      carName: player.carName,
      carClass: player.carClass,
      placement: player.placement,
      totalTimeMs: player.totalTimeMs,
      bestLapMs: player.bestLapMs,
      firstLapMs: player.firstLapMs,
    });

    this.checkRaceComplete();
  }

  /* ------------------------------------------------------------------ */
  /*  Race completion + results broadcast                                 */
  /* ------------------------------------------------------------------ */

  private checkRaceComplete() {
    if (this.state.status === "finished") return;

    const activePlayers = this.state.players.filter(
      (p) => p.raceStatus === "racing",
    );

    // Race ends when all players have finished or disconnected
    if (activePlayers.length === 0) {
      this.finishRace();
    }
  }

  private finishRace() {
    if (this.state.status === "finished") return;
    this.clearTimers();

    this.state.status = "finished";

    // Build final results
    this.state.results.clear();

    // Sort: finished players by placement, then DNF/disconnected
    const playersArr = this.state.players as unknown as LobbyPlayerSchema[];
    const sorted = [...playersArr].sort((a, b) => {
      if (a.placement > 0 && b.placement > 0) return a.placement - b.placement;
      if (a.placement > 0) return -1;
      if (b.placement > 0) return 1;
      return 0;
    });

    for (const p of sorted) {
      const result = new RaceResultSchema();
      result.sessionId = p.sessionId!;
      result.walletAddress = p.walletAddress!;
      result.displayWallet = shortWallet(p.walletAddress!);
      result.carName = p.carName!;
      result.carClass = p.carClass!;
      result.placement = p.placement!;
      result.totalTimeMs = p.totalTimeMs!;
      result.bestLapMs = p.bestLapMs!;
      result.firstLapMs = p.firstLapMs!;
      result.status = p.raceStatus === "finished" ? "finished" : "dnf";
      this.state.results.push(result);
    }

    // Assign DNF placements if needed (for display ordering)
    let dnfPlacement = this.nextPlacement;
    for (const r of this.state.results) {
      if (r.placement === 0) {
        r.placement = dnfPlacement++;
      }
    }

    console.log(
      `[RaceRoom ${this.roomId}] Race finished. ` +
      `${this.state.results.filter((r) => r.status === "finished").length} finishers, ` +
      `${this.state.results.filter((r) => r.status === "dnf").length} DNF.`,
    );

    // Broadcast final results to all clients
    const resultsPayload = this.state.results.map((r) => ({
      sessionId: r.sessionId,
      walletAddress: r.walletAddress,
      displayWallet: r.displayWallet,
      carName: r.carName,
      carClass: r.carClass,
      placement: r.placement,
      totalTimeMs: r.totalTimeMs,
      bestLapMs: r.bestLapMs,
      firstLapMs: r.firstLapMs,
      status: r.status,
    }));

    this.broadcast("race_results", { results: resultsPayload });
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
    player.totalLaps = CITY_LOOP_LAPS;

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

  /* ------------------------------------------------------------------ */
  /*  Countdown + race start                                              */
  /* ------------------------------------------------------------------ */

  private startCountdown() {
    if (this.state.status !== "lobby") return;

    this.state.status = "countdown";
    this.state.countdownSeconds = 5;
    this.state.countdownStartedAt = Date.now();

    console.log(`[RaceRoom ${this.roomId}] Countdown started!`);

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

    const now = Date.now();
    this.state.status = "racing";
    this.state.raceStartedAt = now;
    this.state.countdownSeconds = 0;
    this.nextPlacement = 1;

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
      player.currentLap = 1;
      player.checkpointIndex = 1; // Next expected: first mid-lap checkpoint
      player.checkpointsPassed = 0;
      player.startedAt = now;
      player.finishedAt = 0;
      player.totalTimeMs = 0;
      player.bestLapMs = 0;
      player.firstLapMs = 0;
      player.placement = 0;
      player.lastUpdate = now;
    });

    // Max race duration timer
    this.raceTimer = setTimeout(() => {
      console.log(`[RaceRoom ${this.roomId}] Max race duration reached — finishing.`);
      // Mark remaining racers as DNF
      for (const p of this.state.players) {
        if (p.raceStatus === "racing") {
          p.raceStatus = "dnf";
          p.finishedAt = Date.now();
        }
      }
      this.finishRace();
    }, MAX_RACE_DURATION_MS);

    console.log(`[RaceRoom ${this.roomId}] Race started! ${this.state.players.length} racers.`);
  }

  private clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
    if (this.raceTimer) {
      clearTimeout(this.raceTimer);
      this.raceTimer = undefined;
    }
  }
}
