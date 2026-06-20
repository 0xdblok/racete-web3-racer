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
      <Canvas camera={{ position: [0, 8, 15], fov: 55, far: 300 }} shadows>
        <color attach="background" args={["#050509"]} />
        <fog attach="fog" args={["#050509", 60, 200]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[20, 30, 20]} intensity={2.5} castShadow shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={60} shadow-camera-bottom={-60} />
        <pointLight position={[-40, 15, -30]} intensity={40} color="#d946ef" />
        <pointLight position={[40, 15, 30]} intensity={30} color="#bef264" />
        <pointLight position={[0, 20, 60]} intensity={20} color="#60a5fa" />

        {/* Big test track */}
        <TestTrack />

        {/* Car controller wraps the car model, handles all movement */}
        <CarController stats={gameplayStats} carRef={activeCarRef}>
          <CarModel car={car} selectedCar={selectedCar} gameplayStats={gameplayStats} isDriving />
        </CarController>

        {/* Chase camera follows the car */}
        <ChaseCamera carState={activeCarRef} distance={7} height={3.5} smoothness={3} minDistance={3} maxDistance={25} />

        <Environment preset="night" />
      </Canvas>
    </div>
  );
}
