"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CarGameplayStats } from "@/lib/car-gameplay-stats";
import { useKeyboard } from "@/components/race/useKeyboard";

/* ------------------------------------------------------------------ */
/*  Arcade car controller — transform-based, no physics engine needed  */
/* ------------------------------------------------------------------ */

type CarControllerProps = {
  stats: CarGameplayStats;
  children: React.ReactNode;
  /** Ref that gets updated with current world position + rotation (for camera) */
  carRef?: React.MutableRefObject<{
    position: THREE.Vector3;
    rotation: THREE.Euler;
    speed: number;
    drifting: boolean;
    nitroActive: boolean;
  } | null>;
};

export function CarController({ stats, children, carRef }: CarControllerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const keys = useKeyboard();

  // Physics state (refs to avoid re-renders)
  const velocity = useRef(new THREE.Vector3());
  const speed = useRef(0); // forward speed scalar
  const rotation = useRef(0); // y-rotation in radians
  const worldPos = useRef(new THREE.Vector3(0, 0.3, 0));

  // Nitro state
  const nitroFuel = useRef(stats.nitroDuration); // seconds remaining
  const nitroOnCooldown = useRef(false);
  const nitroCooldownRemaining = useRef(0);

  // Drift state
  const drifting = useRef(false);
  const driftAngle = useRef(0);

  useFrame((_, delta) => {
    const k = keys.current;
    const dt = Math.min(delta, 0.1); // cap delta to avoid physics explosion on tab switch

    // --- Input ---
    const throttle = (k.has("ArrowUp") || k.has("w") || k.has("W")) ? 1 : 0;
    const brake = (k.has("ArrowDown") || k.has("s") || k.has("S")) ? 1 : 0;
    const steerLeft = (k.has("ArrowLeft") || k.has("a") || k.has("A")) ? 1 : 0;
    const steerRight = (k.has("ArrowRight") || k.has("d") || k.has("D")) ? 1 : 0;
    const steerInput = steerRight - steerLeft; // -1 to 1
    const handbrake = k.has("Shift") || k.has("ShiftLeft") || k.has("ShiftRight");
    const nitroKey = k.has(" ") || k.has("Space");
    const resetKey = k.has("r") || k.has("R");

    // --- Reset ---
    if (resetKey) {
      speed.current = 0;
      velocity.current.set(0, 0, 0);
      rotation.current = 0;
      worldPos.current.set(0, 0.3, 0);
      nitroFuel.current = stats.nitroDuration;
      nitroOnCooldown.current = false;
      nitroCooldownRemaining.current = 0;
      drifting.current = false;
      driftAngle.current = 0;
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
      // Recharge nitro when not in use
      if (!nitroOnCooldown.current) {
        nitroFuel.current = Math.min(nitroFuel.current + dt * 0.5, stats.nitroDuration);
      }
    }

    // Nitro cooldown timer
    if (nitroOnCooldown.current) {
      nitroCooldownRemaining.current -= dt;
      if (nitroCooldownRemaining.current <= 0) {
        nitroOnCooldown.current = false;
        nitroFuel.current = stats.nitroDuration;
      }
    }

    // --- Drift ---
    drifting.current = handbrake && Math.abs(speed.current) > 5;

    // --- Arcade physics ---
    const currentSpeed = speed.current;

    // Acceleration / braking
    if (throttle) {
      // Forward
      speed.current += stats.acceleration * dt * (nitroActive ? 1 + stats.nitroPower / 100 : 1);
    } else if (brake) {
      if (currentSpeed > 0) {
        // Brake (forward → slow down)
        speed.current -= stats.brakeForce * dt;
      } else {
        // Reverse
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

    // Clamp speed
    const maxSpd = nitroActive
      ? stats.maxSpeed * (1 + stats.nitroPower / 100)
      : stats.maxSpeed;
    speed.current = THREE.MathUtils.clamp(speed.current, -stats.reverseSpeed, maxSpd);

    // Steering (speed-dependent: slower = sharper turns)
    if (Math.abs(speed.current) > 0.5) {
      const speedFactor = THREE.MathUtils.clamp(1 - Math.abs(speed.current) / maxSpd, 0.2, 1);
      let steerAmount = steerInput * stats.steering * speedFactor * dt;

      if (drifting.current) {
        steerAmount *= 1.6;
        driftAngle.current += steerInput * stats.driftFactor * 1.5 * dt;
        driftAngle.current = THREE.MathUtils.clamp(driftAngle.current, -0.8, 0.8);
      } else {
        // Decay drift angle
        driftAngle.current += (0 - driftAngle.current) * 4 * dt;
      }

      rotation.current += steerAmount;
    } else {
      driftAngle.current += (0 - driftAngle.current) * 4 * dt;
    }

    // Move car forward in its facing direction
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotation.current + driftAngle.current,
    );
    worldPos.current.add(forward.clone().multiplyScalar(speed.current * dt));

    // Clamp to track bounds (large test area: 150x150)
    worldPos.current.x = THREE.MathUtils.clamp(worldPos.current.x, -75, 75);
    worldPos.current.z = THREE.MathUtils.clamp(worldPos.current.z, -75, 75);

    // --- Update group transform ---
    if (groupRef.current) {
      groupRef.current.position.copy(worldPos.current);
      groupRef.current.rotation.set(0, rotation.current + driftAngle.current, 0);
    }

    // --- Update camera ref ---
    if (carRef) {
      carRef.current = {
        position: worldPos.current.clone(),
        rotation: new THREE.Euler(0, rotation.current, 0),
        speed: speed.current,
        drifting: drifting.current,
        nitroActive,
      };
    }
  });

  return <group ref={groupRef}>{children}</group>;
}
