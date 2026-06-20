"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";
import type { TrackConfig } from "@/config/tracks";
import type { PlayerCar } from "@/types/game";
import { resolveCarGameplayStats } from "@/lib/car-gameplay-stats";
import { CarController } from "@/components/race/CarController";
import { ChaseCamera } from "@/components/race/ChaseCamera";
import { CarModel } from "@/components/race/CarModel";
import { TestTrack } from "@/components/race/TestTrack";

/* ------------------------------------------------------------------ */
/*  Car state type (shared between controller and camera)              */
/* ------------------------------------------------------------------ */

export type CarState = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  speed: number;
  drifting: boolean;
  nitroActive: boolean;
};

/* ------------------------------------------------------------------ */
/*  RaceScene                                                          */
/* ------------------------------------------------------------------ */

type RaceSceneProps = {
  car: CarConfig;
  selectedCar: PlayerCar;
  track: TrackConfig;
  carRef?: React.MutableRefObject<CarState | null>;
};

export function RaceScene({ car, selectedCar, carRef }: RaceSceneProps) {
  const gameplayStats = resolveCarGameplayStats(car, selectedCar);
  const internalCarRef = useRef<CarState | null>(null);
  const activeCarRef = carRef || internalCarRef;

  return (
    <div className="h-[calc(100vh-1rem)] min-h-[680px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#050509]">
      <Canvas camera={{ position: [0, 8, 15], fov: 55, far: 2000 }} shadows>
        <color attach="background" args={["#050509"]} />
        <fog attach="fog" args={["#050509", 400, 1200]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 80, 100]} intensity={2.5} castShadow shadow-camera-left={-200} shadow-camera-right={200} shadow-camera-top={150} shadow-camera-bottom={-150} />
        <pointLight position={[-300, 50, -200]} intensity={80} color="#d946ef" />
        <pointLight position={[300, 50, 200]} intensity={60} color="#bef264" />
        <pointLight position={[0, 60, 400]} intensity={40} color="#60a5fa" />

        {/* Huge test track */}
        <TestTrack />

        {/* Car controller wraps the car model, handles all movement */}
        <CarController stats={gameplayStats} carRef={activeCarRef}>
          <CarModel car={car} selectedCar={selectedCar} gameplayStats={gameplayStats} isDriving />
        </CarController>

        {/* Chase camera follows the car */}
        <ChaseCamera carState={activeCarRef} distance={7} height={3.5} smoothness={3} minDistance={3} maxDistance={60} />

        <Environment preset="night" />
      </Canvas>
    </div>
  );
}
