/**
 * Resolves final race-driving stats from base car config + owned upgrade levels.
 *
 * Purpose: Garage upgrades (engine / tires / nitro / handling) now affect
 * actual /race driving physics — maxSpeed, acceleration, grip, nitro, etc.
 *
 * Consumed by: RaceScene → driving controller (when implemented) + RaceHud.
 */

import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";

/* ------------------------------------------------------------------ */
/*  Public type                                                        */
/* ------------------------------------------------------------------ */

export type CarGameplayStats = {
  maxSpeed: number; // game-units top speed (≈ km/h feel)
  acceleration: number; // forward force
  brakeForce: number; // braking power
  reverseSpeed: number; // fixed low value

  steering: number; // turn rate
  grip: number; // lateral friction
  driftFactor: number; // handbrake drift multiplier (lower = cleaner)

  nitroPower: number; // speed bonus during nitro
  nitroDuration: number; // seconds of nitro available
  nitroCooldown: number; // seconds between nitro uses

  drag: number; // natural slowdown force

  // Upgrades (display only — already baked into stats above)
  engineLevel: number;
  tiresLevel: number;
  nitroLevel: number;
  handlingLevel: number;
};

/* ------------------------------------------------------------------ */
/*  Resolver                                                            */
/* ------------------------------------------------------------------ */

/**
 * @param baseCar  CarConfig from src/config/cars.ts (base stats 0–100)
 * @param ownedCar PlayerCar from Supabase (engine/tires/nitro/handling levels 1–10)
 */
export function resolveCarGameplayStats(
  baseCar: CarConfig,
  ownedCar: PlayerCar,
): CarGameplayStats {
  const { stats: s } = baseCar;
  const engine = ownedCar.engine_level;
  const tires = ownedCar.tires_level;
  const nitro = ownedCar.nitro_level;
  const handling = ownedCar.handling_level;

  /* ---- base conversions (car config 0–100 → driving units) ---- */
  // Speed tuning: s.speed is 0-100 (real-world inspired). Multiply by SCALE
  // to get game units. Lower = more controllable, Higher = more extreme.
  const MAX_SPEED_SCALE = 1.3;      // was 2.0 — reduced for controllable feel
  const ACCELERATION_SCALE = 0.22;  // was 0.35
  const NITRO_POWER_SCALE = 0.35;   // was 0.45
  const STEERING_SCALE = 0.22;      // was 0.32

  let maxSpeed = s.speed * MAX_SPEED_SCALE;
  let accelForce = s.acceleration * ACCELERATION_SCALE;
  let brakeF = s.handling * 0.4;
  const reverseSpeed = 15;

  let steer = s.handling * STEERING_SCALE;
  let grip = s.handling * 0.55;
  let drift = (100 - s.handling) * 0.12;

  let nitroPwr = s.nitro * NITRO_POWER_SCALE;
  let nitroDur = 2 + s.nitro * 0.06;
  let nitroCd = 10 - s.nitro * 0.07;

  const drag = 4.5;

  /* ---- upgrade modifiers (per level above 1) ---- */
  const engMul = 1 + (engine - 1) * 0.03; // +3% / level
  const tireGripMul = 1 + (tires - 1) * 0.03;
  const tireBrakeMul = 1 + (tires - 1) * 0.02;
  const nitroPwrMul = 1 + (nitro - 1) * 0.04;
  const nitroDurMul = 1 + (nitro - 1) * 0.03;
  const nitroCdMul = 1 - (nitro - 1) * 0.03; // shorter cooldown
  const handSteerMul = 1 + (handling - 1) * 0.03;
  const handDriftMul = 1 - (handling - 1) * 0.02;

  maxSpeed *= engMul;
  accelForce *= engMul;
  brakeF *= tireBrakeMul;
  grip *= tireGripMul;
  steer *= handSteerMul;
  drift *= handDriftMul;
  nitroPwr *= nitroPwrMul;
  nitroDur *= nitroDurMul;
  nitroCd *= nitroCdMul;

  /* ---- clamp to sane ranges ---- */
  maxSpeed = clamp(maxSpeed, 30, 280);
  accelForce = clamp(accelForce, 8, 45);
  brakeF = clamp(brakeF, 12, 50);
  steer = clamp(steer, 10, 38);
  grip = clamp(grip, 18, 70);
  drift = clamp(drift, 2, 18);
  nitroPwr = clamp(nitroPwr, 8, 50);
  nitroDur = clamp(nitroDur, 1.5, 9);
  nitroCd = clamp(nitroCd, 2, 12);

  return {
    maxSpeed: round(maxSpeed),
    acceleration: round(accelForce),
    brakeForce: round(brakeF),
    reverseSpeed: round(reverseSpeed),
    steering: round(steer),
    grip: round(grip),
    driftFactor: round(drift),
    nitroPower: round(nitroPwr),
    nitroDuration: round(nitroDur, 1),
    nitroCooldown: round(nitroCd, 1),
    drag: round(drag),
    engineLevel: engine,
    tiresLevel: tires,
    nitroLevel: nitro,
    handlingLevel: handling,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number, decimals = 0) {
  const m = 10 ** decimals;
  return Math.round(v * m) / m;
}
