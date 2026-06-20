"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CarGameplayStats } from "@/lib/car-gameplay-stats";
import { useKeyboard } from "@/components/race/useKeyboard";

/* ------------------------------------------------------------------ */
/*  Arcade car controller — smoothed steering, max yaw rate, drift lerp */
/* ------------------------------------------------------------------ */

type CarControllerProps = {
  stats: CarGameplayStats;
  children: React.ReactNode;
  carRef?: React.MutableRefObject<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    speed: number;
    drifting: boolean;
    nitroActive: boolean;
  } | null>;
};

/* ── Tuning constants (tweak these for feel) ── */
const STEER_RISE_SPEED = 2;       // was 6, then 3 — slower ramp-up
const STEER_RETURN_SPEED = 2.5;   // was 4, then 3 — slower return-to-center
const MAX_YAW_RATE = 0.7;         // was 2.5, then 1.3 — heavy feel
const CORNERING_DRAG = 1.2;       // speed loss multiplier when turning
const DRIFT_CORNERING_MULT = 0.5; // drifting loses less speed in corners
const DRIFT_LERP_SPEED = 3;       // how fast drift factor lerps in/out
const DRIFT_STEER_BONUS = 1.4;    // extra steering angle during drift
const DRIFT_LATERAL_SPEED = 1.2;  // how fast drift angle builds laterally

export function CarController({ stats, children, carRef }: CarControllerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useKeyboard();

  // Physics state
  const speed = useRef(0);
  const rotation = useRef(0);       // y-rotation (radians)
  const worldPos = useRef(new THREE.Vector3(0, 0.3, 0));

  // Smoothed steering
  const currentSteer = useRef(0);   // lerped steering (-1..1)
  const driftAngle = useRef(0);     // lateral drift angle (separate from steer)
  const driftFactor = useRef(0);    // 0..1 lerped drift amount

  // Nitro state
  const nitroFuel = useRef(stats.nitroDuration);
  const nitroOnCooldown = useRef(false);
  const nitroCooldownRemaining = useRef(0);

  useFrame((_, delta) => {
    const k = keys.current;
    const dt = Math.min(delta, 0.1);

    // --- Raw binary input ---
    const throttle = (k.has("ArrowUp") || k.has("w") || k.has("W")) ? 1 : 0;
    const brake = (k.has("ArrowDown") || k.has("s") || k.has("S")) ? 1 : 0;
    const steerLeft = (k.has("ArrowLeft") || k.has("a") || k.has("A")) ? 1 : 0;
    const steerRight = (k.has("ArrowRight") || k.has("d") || k.has("D")) ? 1 : 0;
    const steerTarget = steerRight - steerLeft; // -1, 0, or 1
    const handbrake = k.has("Shift") || k.has("ShiftLeft") || k.has("ShiftRight");
    const nitroKey = k.has(" ") || k.has("Space");
    const resetKey = k.has("r") || k.has("R");

    // --- Reset ---
    if (resetKey) {
      speed.current = 0;
      rotation.current = 0;
      currentSteer.current = 0;
      driftAngle.current = 0;
      driftFactor.current = 0;
      worldPos.current.set(0, 0.3, 0);
      nitroFuel.current = stats.nitroDuration;
      nitroOnCooldown.current = false;
      nitroCooldownRemaining.current = 0;
    }

    // --- Smoothed steering ---
    // Lerp currentSteer toward steerTarget
    const target = steerTarget;
    if (target !== 0) {
      // Ramping toward a direction
      const step = STEER_RISE_SPEED * dt;
      if (target > currentSteer.current) {
        currentSteer.current = Math.min(currentSteer.current + step, target);
      } else {
        currentSteer.current = Math.max(currentSteer.current - step, target);
      }
    } else {
      // Return to center
      const step = STEER_RETURN_SPEED * dt;
      if (currentSteer.current > 0) {
        currentSteer.current = Math.max(currentSteer.current - step, 0);
      } else {
        currentSteer.current = Math.min(currentSteer.current + step, 0);
      }
    }

    // --- Nitro management ---
    let nitroActive = false;
    if (nitroKey && nitroFuel.current > 0 && !nitroOnCooldown.current) {
      nitroActive = true;
      nitroFuel.current -= dt;
      if (nitroFuel.current <= 0) {
        nitroFuel.current = 0;
        nitroOnCooldown.current = true;
        nitroCooldownRemaining.current = stats.nitroCooldown;
      }
    } else {
      if (!nitroOnCooldown.current) {
        nitroFuel.current = Math.min(nitroFuel.current + dt * 0.5, stats.nitroDuration);
      }
    }
    if (nitroOnCooldown.current) {
      nitroCooldownRemaining.current -= dt;
      if (nitroCooldownRemaining.current <= 0) {
        nitroOnCooldown.current = false;
        nitroFuel.current = stats.nitroDuration;
      }
    }

    // --- Drift (smoothed) ---
    const driftTarget = (handbrake && Math.abs(speed.current) > 5) ? 1 : 0;
    // Lerp driftFactor toward target
    const driftStep = DRIFT_LERP_SPEED * dt;
    if (driftTarget > driftFactor.current) {
      driftFactor.current = Math.min(driftFactor.current + driftStep, driftTarget);
    } else {
      driftFactor.current = Math.max(driftFactor.current - driftStep, driftTarget);
    }
    const isDrifting = driftFactor.current > 0.05;

    // --- Acceleration / braking ---
    const currentSpeed = speed.current;
    const maxSpd = nitroActive
      ? stats.maxSpeed * (1 + stats.nitroPower / 100)
      : stats.maxSpeed;

    if (throttle) {
      speed.current += stats.acceleration * dt * (nitroActive ? 1 + stats.nitroPower / 100 : 1);
    } else if (brake) {
      if (currentSpeed > 0) {
        speed.current -= stats.brakeForce * dt;
      } else {
        speed.current -= stats.reverseSpeed * 0.3 * dt;
      }
    } else {
      // Natural drag
      if (currentSpeed > 0) {
        speed.current -= stats.drag * dt;
      } else if (currentSpeed < 0) {
        speed.current += stats.drag * dt;
      }
    }
    // --- Cornering drag (lose speed while turning) ---
    if (Math.abs(speed.current) > 1) {
      const steerAbs = Math.abs(currentSteer.current);
      if (steerAbs > 0.02) {
        const speedRatio = Math.abs(speed.current) / maxSpd;
        const dragMult = isDrifting ? DRIFT_CORNERING_MULT : 1.0;
        const turnDrag = steerAbs * speedRatio * CORNERING_DRAG * dragMult;
        // Apply as proportional drag: reduce speed by turnDrag fraction per second
        speed.current -= speed.current * turnDrag * dt;
      }
    }
    speed.current = THREE.MathUtils.clamp(speed.current, -stats.reverseSpeed, maxSpd);

    // --- Steering (speed-based + max yaw rate) ---
    if (Math.abs(speed.current) > 0.5) {
      const absSpeed = Math.abs(speed.current);

      // Speed factor: slower → sharper turns, faster → less aggressive
      // At 0→1 range where 1=maxSpeed
      const speedRatio = absSpeed / maxSpd;
      // Invert: low speed = high factor (1.0), high speed = low factor (0.35)
      const speedFactor = 1.0 - speedRatio * 0.65;

      // Base steering amount (radians/sec)
      let steerRate = currentSteer.current * stats.steering * speedFactor;

      // Drift bonus
      if (isDrifting) {
        steerRate *= DRIFT_STEER_BONUS;
        driftAngle.current += currentSteer.current * stats.driftFactor * DRIFT_LATERAL_SPEED * dt;
        driftAngle.current = THREE.MathUtils.clamp(driftAngle.current, -0.7, 0.7);
      } else {
        // Decay lateral drift angle
        driftAngle.current += (0 - driftAngle.current) * 3 * dt;
      }

      // Cap max yaw rate
      steerRate = THREE.MathUtils.clamp(steerRate, -MAX_YAW_RATE, MAX_YAW_RATE);

      rotation.current += steerRate * dt;
    } else {
      // Car nearly stopped — decay drift angle only
      driftAngle.current += (0 - driftAngle.current) * 4 * dt;
    }

    // --- Movement ---
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotation.current + driftAngle.current * driftFactor.current,
    );
    worldPos.current.add(forward.clone().multiplyScalar(speed.current * dt));

    // --- Clamp bounds (huge test map: 750×750 → 1500×1500 area) ---
    worldPos.current.x = THREE.MathUtils.clamp(worldPos.current.x, -750, 750);
    worldPos.current.z = THREE.MathUtils.clamp(worldPos.current.z, -750, 750);

    // --- Update group transform ---
    if (groupRef.current) {
      groupRef.current.position.copy(worldPos.current);
      groupRef.current.rotation.set(0, rotation.current + driftAngle.current * driftFactor.current, 0);
    }

    // --- Update camera ref ---
    if (carRef) {
      carRef.current = {
        position: worldPos.current.clone(),
        rotation: new THREE.Euler(0, rotation.current, 0),
        speed: speed.current,
        drifting: isDrifting,
        nitroActive,
      };
    }
  });

  return <group ref={groupRef}>{children}</group>;
}
