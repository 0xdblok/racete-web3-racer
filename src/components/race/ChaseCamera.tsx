"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Chase camera — follows car, smooth lerp, speed FOV, nitro shake    */
/* ------------------------------------------------------------------ */

type CarState = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  speed: number;
  drifting: boolean;
  nitroActive: boolean;
} | null;

type ChaseCameraProps = {
  carState: React.MutableRefObject<CarState>;
  /** Distance behind car (base) */
  distance?: number;
  /** Height above car */
  height?: number;
  /** How fast the camera catches up (higher = snappier) */
  smoothness?: number;
};

export function ChaseCamera({
  carState,
  distance = 7,
  height = 3.5,
  smoothness = 3,
}: ChaseCameraProps) {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const targetPos = useRef(new THREE.Vector3(0, height, distance));
  const currentLookAt = useRef(new THREE.Vector3(0, 1, 0));
  const shakeOffset = useRef(new THREE.Vector3());

  // Store initial FOV
  const baseFov = useRef(cam.fov);

  // eslint-disable-next-line
  useFrame((_, delta) => {
    const car = carState.current;
    const dt = Math.min(delta, 0.1);

    // Compute desired camera target + position
    const desiredLookAt = new THREE.Vector3(0, 1, 0);
    const desiredPos = new THREE.Vector3(0, height, distance);

    if (car) {
      const carForward = new THREE.Vector3(0, 0, 1).applyEuler(car.rotation);
      const speedFactor = THREE.MathUtils.clamp(Math.abs(car.speed) / 200, 0, 1);
      const dynamicDist = distance + speedFactor * 3;
      const behindCar = carForward.clone().multiplyScalar(-dynamicDist);

      desiredPos.copy(car.position).add(behindCar).add(new THREE.Vector3(0, height, 0));
      desiredLookAt.copy(car.position).add(carForward.clone().multiplyScalar(4));

      // Drift camera offset
      if (car.drifting) {
        const carRight = new THREE.Vector3(1, 0, 0).applyEuler(car.rotation);
        desiredPos.add(carRight.clone().multiplyScalar(1.5));
        desiredLookAt.add(carRight.clone().multiplyScalar(1.5));
      }

      // Nitro shake
      shakeOffset.current.set(0, 0, 0);
      if (car.nitroActive) {
        shakeOffset.current.set(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.15,
        );
        desiredPos.add(shakeOffset.current);
      }

      // Speed-based FOV
      const targetFov = baseFov.current + speedFactor * 12 + (car.nitroActive ? 4 : 0);
      // eslint-disable-next-line
      cam.fov += (targetFov - cam.fov) * 4 * dt;
    }

    // Smooth lerp
    const t = 1 - Math.exp(-smoothness * dt);
    currentLookAt.current.lerp(desiredLookAt, t);

    camera.position.lerp(desiredPos, t);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
