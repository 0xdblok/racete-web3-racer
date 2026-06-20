"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Classic third-person racing camera                                 */
/*  Behind the car, looking forward over the vehicle, smooth follow     */
/*  Mouse wheel / +/- keys zoom support                                */
/* ------------------------------------------------------------------ */

/* ── Tuning constants ── */
const BASE_DISTANCE = 5;        // was 6 — closer to vehicle
const BASE_HEIGHT = 2.8;        // camera height above car
const LOOK_AHEAD = 8;           // how far ahead of car to look (meters)
const FOLLOW_SMOOTHNESS = 7;    // was 4 — faster position catch-up
const ROTATION_SMOOTHNESS = 8;  // was 5 — faster lookAt catch-up
const SPEED_PULLBACK = 2;       // was 4 — less pullback at max speed
const NITRO_PULLBACK = 1;       // was 2 — less pullback during nitro
const MIN_ZOOM = 2.5;           // closest zoom (mouse wheel)
const MAX_ZOOM = 50;            // farthest zoom
const ZOOM_SPEED = 0.6;         // wheel sensitivity
const DRIFT_OFFSET = 1.2;       // how far camera shifts sideways in drift
const NITRO_SHAKE = 0.12;       // nitro camera shake intensity

/* Export the type so the controller can use it */
export type ChaseCarState = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  speed: number;
  drifting: boolean;
  nitroActive: boolean;
} | null;

type ChaseCameraProps = {
  carState: React.MutableRefObject<ChaseCarState>;
  /** Base distance behind car (overridden by wheel zoom after init) */
  distance?: number;
  /** Height above car */
  height?: number;
  /** Position catch-up speed */
  smoothness?: number;
  minDistance?: number;
  maxDistance?: number;
  zoomSpeed?: number;
};

export function ChaseCamera({
  carState,
  distance = BASE_DISTANCE,
  height = BASE_HEIGHT,
  smoothness = FOLLOW_SMOOTHNESS,
  minDistance = MIN_ZOOM,
  maxDistance = MAX_ZOOM,
  zoomSpeed = ZOOM_SPEED,
}: ChaseCameraProps) {
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  // Smooth camera state
  const currentPos = useRef(new THREE.Vector3(0, height, distance));
  const currentLookAt = useRef(new THREE.Vector3(0, 0.8, 5));
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

    // Default: look forward and down from origin
    let desiredPos = new THREE.Vector3(0, height, zoomDistance.current);
    let desiredLookAt = new THREE.Vector3(0, 0.8, 5);

    if (car) {
      const carForward = new THREE.Vector3(0, 0, 1).applyEuler(car.rotation);
      const absSpeed = Math.abs(car.speed);
      const speedFactor = THREE.MathUtils.clamp(absSpeed / 130, 0, 1); // 130 = reference max speed for camera

      // Distance: base + speed pullback + nitro pullback
      const dynamicDist =
        zoomDistance.current +
        speedFactor * SPEED_PULLBACK +
        (car.nitroActive ? NITRO_PULLBACK : 0);

      // Position: behind car
      const behindCar = carForward.clone().multiplyScalar(-dynamicDist);
      desiredPos = car.position.clone().add(behindCar).add(new THREE.Vector3(0, height, 0));

      // Look at: ahead of the car
      desiredLookAt = car.position.clone().add(carForward.clone().multiplyScalar(LOOK_AHEAD));

      // Drift: shift camera sideways
      if (car.drifting) {
        const carRight = new THREE.Vector3(1, 0, 0).applyEuler(car.rotation);
        desiredPos.add(carRight.clone().multiplyScalar(DRIFT_OFFSET));
        desiredLookAt.add(carRight.clone().multiplyScalar(DRIFT_OFFSET * 0.7));
      }

      // Nitro shake
      if (car.nitroActive) {
        desiredPos.add(
          new THREE.Vector3(
            (Math.random() - 0.5) * NITRO_SHAKE * 2,
            (Math.random() - 0.5) * NITRO_SHAKE,
            (Math.random() - 0.5) * NITRO_SHAKE * 2,
          ),
        );
      }

      // Speed FOV
      const targetFov = baseFov.current + speedFactor * 10 + (car.nitroActive ? 5 : 0);
      // eslint-disable-next-line
      cam.fov += (targetFov - cam.fov) * 4 * dt;
    }

    // Smooth position
    const posT = 1 - Math.exp(-smoothness * dt);
    currentPos.current.lerp(desiredPos, posT);

    // Smooth lookAt (separate speed so it doesn't lag too much)
    const lookT = 1 - Math.exp(-ROTATION_SMOOTHNESS * dt);
    currentLookAt.current.lerp(desiredLookAt, lookT);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}
