"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Chase camera — follows car, smooth lerp, speed FOV, nitro shake    */
/*  Mouse wheel / +/- keys zoom support                                */
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
  /** Base distance behind car */
  distance?: number;
  /** Height above car */
  height?: number;
  /** How fast the camera catches up (higher = snappier) */
  smoothness?: number;
  /** Zoom limits */
  minDistance?: number;
  maxDistance?: number;
  /** Zoom speed (wheel sensitivity) */
  zoomSpeed?: number;
};

export function ChaseCamera({
  carState,
  distance = 7,
  height = 3.5,
  smoothness = 3,
  minDistance = 3,
  maxDistance = 25,
  zoomSpeed = 0.5,
}: ChaseCameraProps) {
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const currentLookAt = useRef(new THREE.Vector3(0, 1, 0));
  const shakeOffset = useRef(new THREE.Vector3());
  const baseFov = useRef(cam.fov);
  const zoomDistance = useRef(distance);

  // Mouse wheel zoom
  useEffect(() => {
    const dom = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomDistance.current -= e.deltaY * 0.01 * zoomSpeed;
      zoomDistance.current = THREE.MathUtils.clamp(zoomDistance.current, minDistance, maxDistance);
    };
    dom.addEventListener("wheel", onWheel, { passive: false });
    return () => dom.removeEventListener("wheel", onWheel);
  }, [gl, minDistance, maxDistance, zoomSpeed]);

  // Keyboard zoom (+/- keys)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "=" || e.key === "+") {
        zoomDistance.current -= 1 * zoomSpeed;
        zoomDistance.current = THREE.MathUtils.clamp(zoomDistance.current, minDistance, maxDistance);
      }
      if (e.key === "-" || e.key === "_") {
        zoomDistance.current += 1 * zoomSpeed;
        zoomDistance.current = THREE.MathUtils.clamp(zoomDistance.current, minDistance, maxDistance);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [minDistance, maxDistance, zoomSpeed]);

  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, delta) => {
    const car = carState.current;
    const dt = Math.min(delta, 0.1);

    const desiredLookAt = new THREE.Vector3(0, 1, 0);
    const desiredPos = new THREE.Vector3(0, height, zoomDistance.current);

    if (car) {
      const carForward = new THREE.Vector3(0, 0, 1).applyEuler(car.rotation);
      const speedFactor = THREE.MathUtils.clamp(Math.abs(car.speed) / 200, 0, 1);
      const dynamicDist = zoomDistance.current + speedFactor * 3;
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

    // Smooth lerp (frame-rate independent)
    const t = 1 - Math.exp(-smoothness * dt);
    currentLookAt.current.lerp(desiredLookAt, t);
    camera.position.lerp(desiredPos, t);
    camera.lookAt(currentLookAt.current);
  });

  // Inline zoom indicator — zoom state is managed internally via ref
  return null;
}
