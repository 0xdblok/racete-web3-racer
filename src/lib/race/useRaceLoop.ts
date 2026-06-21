import { useEffect, useRef, useState, useCallback } from "react";
import type { TrackConfig, CheckpointConfig } from "@/config/tracks";
import type { CarState } from "@/components/race/RaceScene";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type RacePhase = "waiting" | "countdown" | "go" | "racing" | "finished";

export type RaceResult = {
  totalTimeMs: number;
  bestLapTimeMs: number;
  lapsCompleted: number;
  checkpointsPassed: number;
  totalCheckpoints: number;
  carId: string;
  trackId: string;
};

export type RaceProgress = {
  phase: RacePhase;
  countdown: number;
  /** Current lap, 1-based. */
  lap: number;
  /** Alias for HUD/readability. */
  currentLap: number;
  /** Total configured laps. */
  totalLaps: number;
  /** Next checkpoint the player must cross. Starts at 1; 0 means start/finish. */
  expectedCheckpointIndex: number;
  /** Back-compat alias used by older HUD/gate code; now means next expected checkpoint. */
  currentCheckpointIndex: number;
  /** Number of checkpoints completed in the current lap, excluding start/finish. */
  currentCheckpoint: number;
  checkpointsPassed: number;
  totalCheckpoints: number;
  totalRaceTimeMs: number;
  /** Back-compat alias for total race time. */
  currentTime: number;
  currentLapTimeMs: number;
  bestLapTimeMs: number;
  /** Back-compat alias. */
  bestLapTime: number;
  wrongWayHint: boolean;
  finished: boolean;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COUNTDOWN_SECONDS = 5;
const GO_DISPLAY_MS = 750;
const WRONG_WAY_WINDOW_MS = 4000;
const WRONG_WAY_FLASH_MS = 1500;

/* ------------------------------------------------------------------ */
/*  Format                                                             */
/* ------------------------------------------------------------------ */

export function formatRaceTime(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const fraction = Math.floor((safeMs % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${fraction.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

type UseRaceLoopOptions = {
  autoStart?: boolean;
  onFinish?: (result: RaceResult) => void;
};

type InternalState = {
  phase: RacePhase;
  countdown: number;
  lap: number;
  expectedIndex: number;
  completedThisLap: number;
  passed: number;
  totalMs: number;
  lapMs: number;
  bestLapMs: number;
  wrongWayAt: number;
  lastCrossAt: number;
  finished: boolean;
  raceStartAt: number;
  lapStartAt: number;
  hasLeftStartArea: boolean;
};

function createInitialState(): InternalState {
  return {
    phase: "waiting",
    countdown: COUNTDOWN_SECONDS,
    lap: 1,
    expectedIndex: 1,
    completedThisLap: 0,
    passed: 0,
    totalMs: 0,
    lapMs: 0,
    bestLapMs: 0,
    wrongWayAt: 0,
    lastCrossAt: 0,
    finished: false,
    raceStartAt: 0,
    lapStartAt: 0,
    hasLeftStartArea: false,
  };
}

function distance2D(car: NonNullable<CarState>, cp: CheckpointConfig): number {
  const dx = car.position.x - cp.x;
  const dz = car.position.z - cp.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function useRaceLoop(
  carRef: React.MutableRefObject<CarState | null>,
  track: TrackConfig,
  options: UseRaceLoopOptions = {},
): RaceProgress & {
  checkpoints: CheckpointConfig[];
  startRace: () => void;
  resetRace: () => void;
  formatRaceTime: (ms: number) => string;
} {
  const { autoStart = true, onFinish } = options;
  const checkpoints = track.checkpoints;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const internalRef = useRef<InternalState>(createInitialState());

  const makeSnapshot = useCallback((s: InternalState): RaceProgress => ({
    phase: s.phase,
    countdown: s.countdown,
    lap: s.lap,
    currentLap: s.lap,
    totalLaps: track.lapCount,
    expectedCheckpointIndex: s.expectedIndex,
    currentCheckpointIndex: s.expectedIndex,
    currentCheckpoint: s.completedThisLap,
    checkpointsPassed: s.passed,
    totalCheckpoints: checkpoints.length,
    totalRaceTimeMs: Math.round(s.totalMs),
    currentTime: Math.round(s.totalMs),
    currentLapTimeMs: Math.round(s.lapMs),
    bestLapTimeMs: Math.round(s.bestLapMs),
    bestLapTime: Math.round(s.bestLapMs),
    wrongWayHint: performance.now() - s.wrongWayAt < WRONG_WAY_FLASH_MS,
    finished: s.finished,
  }), [checkpoints.length, track.lapCount]);

  const [snapshot, setSnapshot] = useState<RaceProgress>(() => makeSnapshot(internalRef.current));

  const broadcast = useCallback(() => {
    setSnapshot(makeSnapshot(internalRef.current));
  }, [makeSnapshot]);

  const resetRace = useCallback(() => {
    internalRef.current = createInitialState();
    broadcast();
    if (autoStart) {
      window.setTimeout(() => {
        internalRef.current.phase = "countdown";
        broadcast();
      }, 0);
    }
  }, [autoStart, broadcast]);

  const startRace = useCallback(() => {
    if (internalRef.current.phase !== "waiting") return;
    internalRef.current.phase = "countdown";
    broadcast();
  }, [broadcast]);

  // Auto-start countdown.
  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(() => {
      if (internalRef.current.phase === "waiting") {
        internalRef.current.phase = "countdown";
        internalRef.current.countdown = COUNTDOWN_SECONDS;
        broadcast();
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [autoStart, broadcast]);

  // Timestamp-based countdown. Timer stays at 0 until the short GO flash ends.
  useEffect(() => {
    if (snapshot.phase !== "countdown") return;

    let raf = 0;
    const countdownStartedAt = performance.now();
    let lastCountdown = COUNTDOWN_SECONDS;

    internalRef.current.countdown = COUNTDOWN_SECONDS;
    broadcast();

    function tick() {
      const now = performance.now();
      const elapsedMs = now - countdownStartedAt;

      if (elapsedMs >= COUNTDOWN_SECONDS * 1000) {
        internalRef.current.phase = "go";
        internalRef.current.countdown = 0;
        internalRef.current.totalMs = 0;
        internalRef.current.lapMs = 0;
        broadcast();
        return;
      }

      const nextCountdown = COUNTDOWN_SECONDS - Math.floor(elapsedMs / 1000);
      if (nextCountdown !== lastCountdown) {
        lastCountdown = nextCountdown;
        internalRef.current.countdown = nextCountdown;
        broadcast();
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snapshot.phase, broadcast]);

  // Keep GO visible briefly, then unlock controls and start race timer at 0.
  useEffect(() => {
    if (snapshot.phase !== "go") return;

    const goStartedAt = performance.now();
    let raf = 0;

    function tick() {
      const now = performance.now();
      if (now - goStartedAt >= GO_DISPLAY_MS) {
        internalRef.current.phase = "racing";
        internalRef.current.countdown = 0;
        internalRef.current.raceStartAt = now;
        internalRef.current.lapStartAt = now;
        internalRef.current.totalMs = 0;
        internalRef.current.lapMs = 0;
        internalRef.current.expectedIndex = 1;
        internalRef.current.completedThisLap = 0;
        internalRef.current.hasLeftStartArea = false;
        broadcast();
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [snapshot.phase, broadcast]);

  // Checkpoint + timing loop.
  useEffect(() => {
    let raf = 0;

    function tick() {
      const cs = carRef.current;
      const state = internalRef.current;

      if (state.phase === "racing") {
        const now = performance.now();
        state.totalMs = Math.max(0, now - state.raceStartAt);
        state.lapMs = Math.max(0, now - state.lapStartAt);

        if (cs && !state.finished && checkpoints.length > 1) {
          const startCp = checkpoints[0];
          const startDist = distance2D(cs, startCp);
          if (!state.hasLeftStartArea && startDist > startCp.radius * 1.15) {
            state.hasLeftStartArea = true;
          }

          const expected = checkpoints[state.expectedIndex];
          const expectedDist = distance2D(cs, expected);
          const canCountStartFinish = state.expectedIndex !== 0 || state.hasLeftStartArea;

          if (expectedDist <= expected.radius && canCountStartFinish) {
            state.passed += 1;
            state.lastCrossAt = now;

            if (state.expectedIndex === 0) {
              // Start/finish only counts after all non-finish checkpoints are done.
              const lapTime = now - state.lapStartAt;
              state.bestLapMs = state.bestLapMs === 0 ? lapTime : Math.min(state.bestLapMs, lapTime);
              state.lapStartAt = now;
              state.completedThisLap = 0;
              state.hasLeftStartArea = false;

              if (state.lap >= track.lapCount) {
                state.finished = true;
                state.phase = "finished";
                state.totalMs = now - state.raceStartAt;
                state.lapMs = lapTime;
                broadcast();

                const result: RaceResult = {
                  totalTimeMs: Math.round(state.totalMs),
                  bestLapTimeMs: Math.round(state.bestLapMs),
                  lapsCompleted: track.lapCount,
                  checkpointsPassed: state.passed,
                  totalCheckpoints: checkpoints.length,
                  carId: "",
                  trackId: track.id,
                };

                window.setTimeout(() => onFinishRef.current?.(result), 0);
              } else {
                state.lap += 1;
                state.expectedIndex = 1;
              }
            } else {
              state.completedThisLap = state.expectedIndex;
              state.expectedIndex = state.expectedIndex + 1;
              if (state.expectedIndex >= checkpoints.length) {
                state.expectedIndex = 0;
              }
            }
          } else if (now - state.lastCrossAt > WRONG_WAY_WINDOW_MS && state.passed > 0) {
            const previousIndex = state.expectedIndex === 0
              ? checkpoints.length - 1
              : state.expectedIndex - 1;
            const previous = checkpoints[previousIndex];
            if (distance2D(cs, previous) <= previous.radius * 0.9) {
              state.wrongWayAt = now;
            }
          }
        }

        broadcast();
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [carRef, checkpoints, broadcast, track.id, track.lapCount]);

  return {
    ...snapshot,
    checkpoints,
    startRace,
    resetRace,
    formatRaceTime,
  };
}
