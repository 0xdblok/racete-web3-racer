import { useEffect, useRef, useState, useCallback } from "react";
import type { TrackConfig, CheckpointConfig } from "@/config/tracks";
import type { CarState } from "@/components/race/RaceScene";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type RacePhase = "waiting" | "countdown" | "racing" | "finished";

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
  lap: number;
  currentCheckpointIndex: number;
  checkpointsPassed: number;
  totalCheckpoints: number;
  totalRaceTimeMs: number;
  currentLapTimeMs: number;
  bestLapTimeMs: number;
  wrongWayHint: boolean;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COUNTDOWN_SECONDS = 3;
const WRONG_WAY_WINDOW_MS = 4000;
const WRONG_WAY_FLASH_MS = 1500;

/* ------------------------------------------------------------------ */
/*  Format                                                             */
/* ------------------------------------------------------------------ */

export function formatRaceTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const fraction = Math.floor((ms % 1000) / 10);
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
  currentIndex: number;
  passed: number;
  totalMs: number;
  lapMs: number;
  bestLapMs: number;
  wrongWayAt: number;
  lastCrossAt: number;
  finished: boolean;
  raceStartAt: number;
  lapStartAt: number;
};

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

  const internalRef = useRef<InternalState>({
    phase: "waiting",
    countdown: COUNTDOWN_SECONDS,
    lap: 1,
    currentIndex: 0,
    passed: 0,
    totalMs: 0,
    lapMs: 0,
    bestLapMs: 0,
    wrongWayAt: 0,
    lastCrossAt: 0,
    finished: false,
    raceStartAt: 0,
    lapStartAt: 0,
  });

  const [snapshot, setSnapshot] = useState<RaceProgress>(() => ({
    phase: "waiting",
    countdown: COUNTDOWN_SECONDS,
    lap: 1,
    currentCheckpointIndex: 0,
    checkpointsPassed: 0,
    totalCheckpoints: checkpoints.length,
    totalRaceTimeMs: 0,
    currentLapTimeMs: 0,
    bestLapTimeMs: 0,
    wrongWayHint: false,
  }));

  const broadcast = useCallback(() => {
    const s = internalRef.current;
    setSnapshot({
      phase: s.phase,
      countdown: s.countdown,
      lap: s.lap,
      currentCheckpointIndex: s.currentIndex,
      checkpointsPassed: s.passed,
      totalCheckpoints: checkpoints.length,
      totalRaceTimeMs: Math.round(s.totalMs),
      currentLapTimeMs: Math.round(s.lapMs),
      bestLapTimeMs: Math.round(s.bestLapMs),
      wrongWayHint: performance.now() - s.wrongWayAt < WRONG_WAY_FLASH_MS,
    });
  }, [checkpoints.length]);

  const resetRace = useCallback(() => {
    internalRef.current = {
      phase: "waiting",
      countdown: COUNTDOWN_SECONDS,
      lap: 1,
      currentIndex: 0,
      passed: 0,
      totalMs: 0,
      lapMs: 0,
      bestLapMs: 0,
      wrongWayAt: 0,
      lastCrossAt: 0,
      finished: false,
      raceStartAt: 0,
      lapStartAt: 0,
    };
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

  // Auto-start
  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(() => {
      if (internalRef.current.phase === "waiting") {
        internalRef.current.phase = "countdown";
        broadcast();
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [autoStart, broadcast]);

  // Countdown interval
  useEffect(() => {
    if (snapshot.phase !== "countdown") return;

    let remaining = COUNTDOWN_SECONDS;
    const interval = window.setInterval(() => {
      remaining -= 1;
      internalRef.current.countdown = remaining;
      broadcast();
      if (remaining <= 0) {
        window.clearInterval(interval);
        const now = performance.now();
        internalRef.current.phase = "racing";
        internalRef.current.countdown = 0;
        internalRef.current.raceStartAt = now;
        internalRef.current.lapStartAt = now;
        broadcast();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [snapshot.phase, broadcast]);

  // Checkpoint + timing loop
  useEffect(() => {
    let raf = 0;

    function tick() {
      const cs = carRef.current;
      const state = internalRef.current;

      if (state.phase === "racing") {
        const now = performance.now();
        state.totalMs = now - state.raceStartAt;
        state.lapMs = now - state.lapStartAt;

        if (cs && !state.finished) {
          const nextIndex = (state.currentIndex + 1) % checkpoints.length;
          const nextCp = checkpoints[nextIndex];
          const dx = cs.position.x - nextCp.x;
          const dz = cs.position.z - nextCp.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist <= nextCp.radius) {
            // Checkpoint crossed
            state.currentIndex = nextIndex;
            state.passed += 1;
            state.lastCrossAt = now;

            if (nextCp.isFinish && state.currentIndex === 0 && state.passed > 1) {
              const lapTime = now - state.lapStartAt;
              state.bestLapMs = state.bestLapMs === 0 ? lapTime : Math.min(state.bestLapMs, lapTime);
              state.lapStartAt = now;

              if (state.lap >= track.lapCount) {
                state.finished = true;
                state.phase = "finished";
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
              }
            }
          } else {
            // Wrong-way detection: close to previous checkpoint after not crossing next for a while
            if (now - state.lastCrossAt > WRONG_WAY_WINDOW_MS && state.passed > 0) {
              const prevCp = checkpoints[state.currentIndex];
              const pdx = cs.position.x - prevCp.x;
              const pdz = cs.position.z - prevCp.z;
              if (Math.sqrt(pdx * pdx + pdz * pdz) <= prevCp.radius * 0.9) {
                state.wrongWayAt = now;
              }
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
