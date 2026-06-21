import { Room, Client } from "colyseus";
import { createHmac } from "crypto";
import { RaceStateSchema, LobbyPlayerSchema, RaceResultSchema } from "../schema/RaceState";
import type { ClientJoinMessage, ClientReadyMessage, ClientMovementMessage, RaceClass } from "../types";
import {
  MAX_PLAUSIBLE_SPEED_MPS,
  CLASS_SPEED_CAPS,
  MAX_POSITION_DELTA_PER_TICK,
  MAX_TELEPORT_DISTANCE,
  MAX_CHECKPOINT_DISTANCE,
  MIN_MULTIPLAYER_TOTAL_TIME_MS,
  MIN_MULTIPLAYER_LAP_TIME_MS,
  MAX_RACE_DURATION_MS,
  SPEED_VIOLATIONS_TO_DQ,
  TELEPORT_VIOLATIONS_TO_DQ,
  CHECKPOINT_VIOLATIONS_TO_DQ,
  OUT_OF_ORDER_VIOLATIONS_TO_DQ,
  MAX_SUSPICIOUS_EVENTS,
} from "../config/anti-cheat";

// ── Track config (hardcoded City Loop for V1) ────────────────────────────

const CITY_LOOP_CHECKPOINTS = 10; // 0=start/finish, 1-9=mid-lap checkpoints
const CITY_LOOP_LAPS = 3;

/** Checkpoint coordinates for proximity validation (mirrors src/config/tracks.ts). */
const CHECKPOINT_COORDS: Record<string, { x: number; z: number; radius: number }> = {
  "cp-start": { x: 0, z: -80, radius: 24 },
  "cp-north": { x: 0, z: 200, radius: 28 },
  "cp-northeast": { x: 120, z: 340, radius: 28 },
  "cp-east": { x: 320, z: 260, radius: 28 },
  "cp-southeast": { x: 380, z: 0, radius: 28 },
  "cp-south": { x: 340, z: -120, radius: 28 },
  "cp-southwest": { x: 260, z: -220, radius: 28 },
  "cp-west-return": { x: 140, z: -260, radius: 28 },
  "cp-west": { x: -80, z: -180, radius: 28 },
  "cp-return": { x: -80, z: 0, radius: 28 },
};

const SPAWN_LANES = [
  { x: -4, z: -80 },
  { x: 4, z: -86 },
  { x: -8, z: -92 },
  { x: 8, z: -98 },
  { x: -12, z: -104 },
  { x: 12, z: -110 },
];

// ── Reward signing ──────────────────────────────────────────────────────

const REWARD_SECRET = process.env.MULTIPLAYER_REWARD_SECRET || "";
const REWARD_PAYLOAD_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function shortWallet(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function canonicalJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function signPayload(payload: Record<string, unknown>): string {
  if (!REWARD_SECRET) return "";
  const canonical = canonicalJson(payload);
  return createHmac("sha256", REWARD_SECRET).update(canonical).digest("hex");
}

function makeServerRaceId(roomId: string, raceStartedAt: number): string {
  return `mp:${roomId}:${raceStartedAt}`;
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

    if (player.raceStatus === "racing") {
      player.raceStatus = "disconnected";
      player.finishedAt = Date.now();
      console.log(`[RaceRoom] Player ${shortWallet(player.walletAddress)} DNF (disconnected during race)`);
      this.broadcast("player_dnf", {
        sessionId: player.sessionId,
        walletAddress: player.walletAddress,
        displayWallet: shortWallet(player.walletAddress),
        status: "disconnected",
      });
      this.checkRaceComplete();
    } else if (player.raceStatus === "disqualified") {
      // DQ player leaving — broadcast removal but don't change race state
      console.log(`[RaceRoom] DQ player ${shortWallet(player.walletAddress)} left room`);
    } else {
      const idx = this.state.players.findIndex((p) => p.sessionId === client.sessionId);
      if (idx !== -1) {
        this.state.players.splice(idx, 1);
      }
    }

    if (this.state.players.length === 0) {
      this.disconnect();
    }

    if (this.state.status === "countdown" && this.state.players.length < this.state.minPlayersToStart) {
      this.cancelCountdown();
    }
  }

  override onDispose() {
    this.clearTimers();
    console.log(`[RaceRoom] Room ${this.roomId} disposed.`);
  }

  /* ------------------------------------------------------------------ */
  /*  Join / Ready                                                        */
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

  /* ------------------------------------------------------------------ */
  /*  MOVEMENT — with anti-cheat                                          */
  /* ------------------------------------------------------------------ */

  private handleMovement(client: Client, message: ClientMovementMessage) {
    if (this.state.status !== "racing") return;

    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) return;
    if (player.raceStatus !== "racing" && player.raceStatus !== "disqualified") return;
    // Once disqualified, stop processing movement but keep sending errors
    if (player.raceStatus === "disqualified") {
      client.send("error", { message: "Disqualified — movement ignored" });
      return;
    }

    // ── NaN / Infinity guard ────────────────────────────────────────
    if (
      !Number.isFinite(message.x) || !Number.isFinite(message.y) ||
      !Number.isFinite(message.z) || !Number.isFinite(message.yaw) ||
      !Number.isFinite(message.speed)
    ) {
      player.suspiciousEvents += 1;
      player.acFlagReason = `NaN/Infinity movement values`;
      console.warn(`[AC] ${shortWallet(player.walletAddress)} sent NaN/Infinity movement — event #${player.suspiciousEvents}`);
      const dq = this.maybeDisqualify(player, client);
      if (dq) return;
      // Ignore the message
      client.send("movement_result", { accepted: false, error: "Invalid movement values" });
      return;
    }

    // ── Sanity clamp (permissive) ───────────────────────────────────
    const newX = clampFinite(message.x, -520, 520, player.x);
    const newY = clampFinite(message.y, -20, 40, player.y);
    const newZ = clampFinite(message.z, -520, 520, player.z);
    const newSpeed = clampFinite(message.speed, -50, 500, player.speed);

    // ── Speed violation check ───────────────────────────────────────
    const speedCap = CLASS_SPEED_CAPS[player.carClass] ?? CLASS_SPEED_CAPS.open;
    if (newSpeed > speedCap) {
      player.speedViolations += 1;
      player.suspiciousEvents += 1;
      player.acFlagReason = `speed ${newSpeed.toFixed(0)} m/s > class cap ${speedCap}`;
      console.warn(
        `[AC] ${shortWallet(player.walletAddress)} speed violation: ${newSpeed.toFixed(0)} m/s (class cap ${speedCap}) — ` +
        `#${player.speedViolations}/${SPEED_VIOLATIONS_TO_DQ}`,
      );
      const dq = this.maybeDisqualify(player, client);
      if (dq) return;
    }

    // ── Position delta / teleport check ─────────────────────────────
    const now = Date.now();
    const dt = (now - player.lastUpdate) / 1000;
    if (player.lastUpdate > 0 && dt > 0.001) {
      const dx = newX - player.x;
      const dz = newZ - player.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Teleport: any single-frame jump beyond threshold
      if (dist > MAX_TELEPORT_DISTANCE) {
        player.teleportViolations += 1;
        player.suspiciousEvents += 1;
        player.acFlagReason = `teleport ${dist.toFixed(1)}m > ${MAX_TELEPORT_DISTANCE}m cap`;
        console.warn(
          `[AC] ${shortWallet(player.walletAddress)} teleport: ${dist.toFixed(1)}m in ${(dt * 1000).toFixed(0)}ms — ` +
          `#${player.teleportViolations}/${TELEPORT_VIOLATIONS_TO_DQ}`,
        );
        const dq = this.maybeDisqualify(player, client);
        if (dq) return;
      }

      // Max per-tick delta
      if (dist > MAX_POSITION_DELTA_PER_TICK && dt < 1.0) {
        player.suspiciousEvents += 1;
        console.warn(
          `[AC] ${shortWallet(player.walletAddress)} large delta: ${dist.toFixed(1)}m in ${(dt * 1000).toFixed(0)}ms`,
        );
      }

      // Plausible speed estimate from position delta
      if (dt > 0.05) {
        const estimatedSpeed = dist / dt;
        if (estimatedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
          player.speedViolations += 1;
          player.suspiciousEvents += 1;
          player.acFlagReason = `estimated speed ${estimatedSpeed.toFixed(0)} m/s > global cap ${MAX_PLAUSIBLE_SPEED_MPS}`;
          console.warn(
            `[AC] ${shortWallet(player.walletAddress)} estimated speed violation: ${estimatedSpeed.toFixed(0)} m/s from position delta`,
          );
          const dq = this.maybeDisqualify(player, client);
          if (dq) return;
        }
      }
    }

    // ── Accept movement ─────────────────────────────────────────────
    player.x = newX;
    player.y = newY;
    player.z = newZ;
    player.yaw = clampFinite(message.yaw, -Math.PI * 4, Math.PI * 4, player.yaw);
    player.speed = newSpeed;
    player.isNitro = Boolean(message.isNitro);
    player.isDrifting = Boolean(message.isDrifting);
    player.raceStatus = "racing";
    player.lastUpdate = now;
  }

  /* ------------------------------------------------------------------ */
  /*  CHECKPOINT — sequential + proximity validation                      */
  /* ------------------------------------------------------------------ */

  private handleCheckpoint(client: Client, message: CheckpointMessage) {
    if (this.state.status !== "racing") return;

    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) return;
    if (player.raceStatus !== "racing" && player.raceStatus !== "disqualified") return;
    if (player.raceStatus === "disqualified") {
      client.send("checkpoint_result", { valid: false, error: "Disqualified" });
      return;
    }

    const cpOrder = this.parseCheckpointOrder(message.checkpointId);
    if (cpOrder === null) {
      // Unknown checkpoint ID
      player.suspiciousEvents += 1;
      console.warn(`[AC] ${shortWallet(player.walletAddress)} sent unknown checkpoint ID: ${message.checkpointId}`);
      client.send("checkpoint_result", { valid: false, error: "Unknown checkpoint" });
      return;
    }

    // ── Proximity validation ────────────────────────────────────────
    const cpCoord = CHECKPOINT_COORDS[message.checkpointId];
    if (cpCoord) {
      const dx = player.x - cpCoord.x;
      const dz = player.z - cpCoord.z;
      const distToCp = Math.sqrt(dx * dx + dz * dz);

      if (distToCp > MAX_CHECKPOINT_DISTANCE) {
        player.checkpointViolations += 1;
        player.suspiciousEvents += 1;
        player.acFlagReason = `checkpoint ${message.checkpointId} too far: ${distToCp.toFixed(1)}m > ${MAX_CHECKPOINT_DISTANCE}m`;
        console.warn(
          `[AC] ${shortWallet(player.walletAddress)} checkpoint proximity violation: ` +
          `${message.checkpointId} at distance ${distToCp.toFixed(1)}m (cap ${MAX_CHECKPOINT_DISTANCE}m) — ` +
          `#${player.checkpointViolations}/${CHECKPOINT_VIOLATIONS_TO_DQ}`,
        );
        const dq = this.maybeDisqualify(player, client);
        if (dq) return;
        client.send("checkpoint_result", { valid: false, error: "Too far from checkpoint" });
        return;
      }
    }

    // ── Sequential order check ──────────────────────────────────────
    const expectedOrder = player.checkpointIndex;

    if (cpOrder !== expectedOrder) {
      // Out of order — log and increment counter
      player.outOfOrderViolations += 1;
      player.suspiciousEvents += 1;
      console.warn(
        `[AC] ${shortWallet(player.walletAddress)} out-of-order checkpoint: ` +
        `got ${cpOrder} (${message.checkpointId}), expected ${expectedOrder} — ` +
        `#${player.outOfOrderViolations}/${OUT_OF_ORDER_VIOLATIONS_TO_DQ}`,
      );
      const dq = this.maybeDisqualify(player, client);
      if (dq) return;
      // Silently ignore for the client (may be stale resend)
      return;
    }

    // ── Valid checkpoint crossing ───────────────────────────────────
    player.checkpointsPassed += 1;

    if (cpOrder === 0) {
      // Start/finish line — lap completed
      const now = Date.now();
      const lapTime = now - player.startedAt;

      if (player.firstLapMs === 0 && player.currentLap === 1) {
        player.firstLapMs = lapTime;
      }

      // ── Lap time plausibility ───────────────────────────────────
      if (lapTime > 0 && lapTime < MIN_MULTIPLAYER_LAP_TIME_MS) {
        player.suspiciousEvents += 1;
        console.warn(
          `[AC] ${shortWallet(player.walletAddress)} impossibly fast lap: ${lapTime}ms < ${MIN_MULTIPLAYER_LAP_TIME_MS}ms`,
        );
        const dq = this.maybeDisqualify(player, client);
        if (dq) return;
      }

      if (player.currentLap >= player.totalLaps) {
        player.checkpointIndex = 0;
      } else {
        player.currentLap += 1;
        player.checkpointIndex = 1;
      }
    } else if (cpOrder === CITY_LOOP_CHECKPOINTS - 1) {
      player.checkpointIndex = 0;
    } else {
      player.checkpointIndex = cpOrder + 1;
    }

    client.send("checkpoint_result", {
      valid: true,
      checkpointId: message.checkpointId,
      currentLap: player.currentLap,
      totalLaps: player.totalLaps,
      checkpointIndex: player.checkpointIndex,
      checkpointsPassed: player.checkpointsPassed,
    });
  }

  private parseCheckpointOrder(id: string): number | null {
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
  /*  FINISH — with DQ check                                              */
  /* ------------------------------------------------------------------ */

  private handleFinish(client: Client, message: FinishMessage) {
    if (this.state.status !== "racing") return;

    const player = this.state.players.find((p) => p.sessionId === client.sessionId);
    if (!player) {
      client.send("finish_result", { accepted: false, error: "Player not found" });
      return;
    }

    // ── DQ guard ────────────────────────────────────────────────────
    if (player.raceStatus === "disqualified") {
      client.send("finish_result", { accepted: false, error: "Disqualified — finish rejected", dq: true });
      console.warn(`[AC] ${shortWallet(player.walletAddress)} attempted finish while disqualified`);
      return;
    }

    if (player.raceStatus === "finished") {
      client.send("finish_result", { accepted: false, error: "Already finished" });
      return;
    }

    // ── Pre-finish DQ check (catch-all suspicious threshold) ────────
    if (player.suspiciousEvents >= MAX_SUSPICIOUS_EVENTS) {
      this.disqualifyPlayer(player, client, `suspicious events ${player.suspiciousEvents} >= ${MAX_SUSPICIOUS_EVENTS}`);
      client.send("finish_result", { accepted: false, error: "Disqualified", dq: true });
      return;
    }

    // Laps
    if (player.currentLap < player.totalLaps) {
      client.send("finish_result", {
        accepted: false,
        error: `Not enough laps: ${player.currentLap}/${player.totalLaps}`,
      });
      return;
    }

    // Checkpoint order
    if (player.checkpointIndex !== 0 && player.checkpointsPassed > 0) {
      client.send("finish_result", {
        accepted: false,
        error: "Must cross start/finish line to complete",
      });
      return;
    }

    // Minimum checkpoints
    const minCheckpoints = player.totalLaps * CITY_LOOP_CHECKPOINTS;
    if (player.checkpointsPassed < minCheckpoints) {
      client.send("finish_result", {
        accepted: false,
        error: `Missing checkpoints: ${player.checkpointsPassed}/${minCheckpoints}`,
      });
      return;
    }

    // Time
    const now = Date.now();
    const totalTimeMs = now - player.startedAt;

    if (totalTimeMs < MIN_MULTIPLAYER_TOTAL_TIME_MS) {
      player.suspiciousEvents += 1;
      console.warn(
        `[AC] ${shortWallet(player.walletAddress)} impossibly fast finish: ${totalTimeMs}ms < ${MIN_MULTIPLAYER_TOTAL_TIME_MS}ms`,
      );
      const dq = this.maybeDisqualify(player, client);
      if (dq) {
        client.send("finish_result", { accepted: false, error: "Disqualified — impossibly fast finish", dq: true });
        return;
      }
      client.send("finish_result", { accepted: false, error: "Finish time is impossibly fast" });
      return;
    }

    // ── Accept finish ───────────────────────────────────────────────
    player.raceStatus = "finished";
    player.finishedAt = now;
    player.totalTimeMs = totalTimeMs;
    player.bestLapMs = message.bestLapMs ?? player.bestLapMs;
    player.firstLapMs = message.firstLapMs ?? player.firstLapMs;
    player.placement = this.nextPlacement++;

    console.log(
      `[RaceRoom] Player finished: ${shortWallet(player.walletAddress)} ` +
      `Place #${player.placement} Time ${totalTimeMs}ms Laps ${player.currentLap} ` +
      `[AC: ${player.suspiciousEvents} events, ${player.speedViolations}s ${player.teleportViolations}t ${player.checkpointViolations}c ${player.outOfOrderViolations}o]`,
    );

    client.send("finish_result", {
      accepted: true,
      placement: player.placement,
      totalTimeMs: player.totalTimeMs,
      bestLapMs: player.bestLapMs,
      firstLapMs: player.firstLapMs,
    });

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
      status: "finished",
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

    if (activePlayers.length === 0) {
      this.finishRace();
    }
  }

  private finishRace() {
    if (this.state.status === "finished") return;
    this.clearTimers();

    this.state.status = "finished";

    this.state.results.clear();

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

      // Map player raceStatus to result status
      if (p.raceStatus === "finished") {
        result.status = "finished";
      } else if (p.raceStatus === "disqualified") {
        result.status = "disqualified";
      } else if (p.raceStatus === "disconnected") {
        result.status = "disconnected";
      } else {
        result.status = "dnf";
      }

      this.state.results.push(result);
    }

    // Assign DNF/DQ placements
    let dnfPlacement = this.nextPlacement;
    for (const r of this.state.results) {
      if (r.placement === 0) {
        r.placement = dnfPlacement++;
      }
    }

    const finishers = this.state.results.filter((r) => r.status === "finished").length;
    const dnfs = this.state.results.filter((r) => r.status === "dnf" || r.status === "disconnected").length;
    const dqs = this.state.results.filter((r) => r.status === "disqualified").length;

    console.log(
      `[RaceRoom ${this.roomId}] Race finished. ` +
      `${finishers} finishers, ${dnfs} DNF, ${dqs} DQ.`,
    );

    // Generate unique server race ID
    const serverRaceId = makeServerRaceId(this.roomId, this.state.raceStartedAt);
    const expiresAt = new Date(Date.now() + REWARD_PAYLOAD_EXPIRY_MS).toISOString();
    const totalPlayers = this.state.players.length;
    const finishedAt = new Date().toISOString();

    // Broadcast final results
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

    // ── Generate signed reward payloads — ONLY for finished players ──
    for (const p of this.state.results) {
      // Skip non-finished players: no reward for DQ, DNF, or disconnected
      if (p.status !== "finished") continue;

      // Find the player schema to get carId and AC data
      const player = (this.state.players as unknown as LobbyPlayerSchema[]).find(
        (pl) => pl.walletAddress === p.walletAddress,
      );

      // Extra safety: don't sign if player was suspicious (belt + suspenders)
      if (player && (player.suspiciousEvents >= MAX_SUSPICIOUS_EVENTS || player.raceStatus === "disqualified")) {
        console.warn(
          `[AC] ${shortWallet(p.walletAddress!)} blocked from reward — ` +
          `${player.suspiciousEvents} suspicious events, status=${player.raceStatus}`,
        );
        continue;
      }

      const rewardPayload = {
        version: 1,
        raceMode: "multiplayer",
        roomId: this.roomId,
        serverRaceId,
        walletAddress: p.walletAddress,
        trackId: "city-loop",
        carId: player?.selectedCarId || "",
        carClass: p.carClass,
        placement: p.placement,
        totalPlayers,
        totalTimeMs: p.totalTimeMs,
        bestLapMs: p.bestLapMs,
        firstLapMs: p.firstLapMs,
        lapsCompleted: CITY_LOOP_LAPS,
        checkpointsCompleted: CITY_LOOP_LAPS * CITY_LOOP_CHECKPOINTS,
        status: "finished",
        finishedAt,
        expiresAt,
      };

      const signature = signPayload(rewardPayload);

      const signedReward = {
        payload: rewardPayload,
        signature,
      };

      const client = this.clients.find((c) => {
        const player = this.state.players.find((pl) => pl.sessionId === c.sessionId);
        return player?.walletAddress === p.walletAddress;
      });

      if (client) {
        client.send("multiplayer_reward", signedReward);
        console.log(`[RaceRoom] Sent signed reward to ${shortWallet(p.walletAddress!)} (Place #${p.placement}, ${p.totalTimeMs}ms)`);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Anti-cheat: DQ logic                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Check if player should be disqualified based on accumulated violations.
   * Returns true if player was DQ'd.
   */
  private maybeDisqualify(player: LobbyPlayerSchema, client: Client): boolean {
    if (player.speedViolations >= SPEED_VIOLATIONS_TO_DQ) {
      this.disqualifyPlayer(player, client, `speed violations ${player.speedViolations}/${SPEED_VIOLATIONS_TO_DQ}`);
      return true;
    }
    if (player.teleportViolations >= TELEPORT_VIOLATIONS_TO_DQ) {
      this.disqualifyPlayer(player, client, `teleport violations ${player.teleportViolations}/${TELEPORT_VIOLATIONS_TO_DQ}`);
      return true;
    }
    if (player.checkpointViolations >= CHECKPOINT_VIOLATIONS_TO_DQ) {
      this.disqualifyPlayer(player, client, `checkpoint violations ${player.checkpointViolations}/${CHECKPOINT_VIOLATIONS_TO_DQ}`);
      return true;
    }
    if (player.outOfOrderViolations >= OUT_OF_ORDER_VIOLATIONS_TO_DQ) {
      this.disqualifyPlayer(player, client, `out-of-order violations ${player.outOfOrderViolations}/${OUT_OF_ORDER_VIOLATIONS_TO_DQ}`);
      return true;
    }
    if (player.suspiciousEvents >= MAX_SUSPICIOUS_EVENTS) {
      this.disqualifyPlayer(player, client, `suspicious events ${player.suspiciousEvents}/${MAX_SUSPICIOUS_EVENTS}`);
      return true;
    }
    return false;
  }

  private disqualifyPlayer(player: LobbyPlayerSchema, client: Client, reason: string) {
    const prevStatus = player.raceStatus;
    player.raceStatus = "disqualified";
    player.finishedAt = Date.now();
    player.acFlagReason = reason;

    console.warn(
      `[AC] ${shortWallet(player.walletAddress)} DISQUALIFIED: ${reason} ` +
      `(S:${player.suspiciousEvents} sp:${player.speedViolations} t:${player.teleportViolations} ` +
      `c:${player.checkpointViolations} o:${player.outOfOrderViolations})`,
    );

    // Notify the player
    client.send("player_disqualified", {
      reason,
      suspiciousEvents: player.suspiciousEvents,
      speedViolations: player.speedViolations,
      teleportViolations: player.teleportViolations,
      checkpointViolations: player.checkpointViolations,
    });

    // Broadcast DQ to all clients
    this.broadcast("player_dq", {
      sessionId: player.sessionId,
      walletAddress: player.walletAddress,
      displayWallet: shortWallet(player.walletAddress),
      reason,
    });

    // If player was racing, check if race is now complete
    if (prevStatus === "racing") {
      this.checkRaceComplete();
    }
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

    // Reset anti-cheat counters
    player.suspiciousEvents = 0;
    player.speedViolations = 0;
    player.teleportViolations = 0;
    player.checkpointViolations = 0;
    player.outOfOrderViolations = 0;
    player.acFlagReason = "";

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
      player.checkpointIndex = 1;
      player.checkpointsPassed = 0;
      player.startedAt = now;
      player.finishedAt = 0;
      player.totalTimeMs = 0;
      player.bestLapMs = 0;
      player.firstLapMs = 0;
      player.placement = 0;
      player.lastUpdate = now;

      // Reset anti-cheat counters on race start
      player.suspiciousEvents = 0;
      player.speedViolations = 0;
      player.teleportViolations = 0;
      player.checkpointViolations = 0;
      player.outOfOrderViolations = 0;
      player.acFlagReason = "";
    });

    // Max race duration timer
    this.raceTimer = setTimeout(() => {
      console.log(`[RaceRoom ${this.roomId}] Max race duration reached — finishing.`);
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
