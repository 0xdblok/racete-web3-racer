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
import { ChaseCamera, type ChaseCarState } from "@/components/race/ChaseCamera";
import { CarModel } from "@/components/race/CarModel";
import { RaceMap } from "@/components/race/RaceMap";
import { RemoteCar } from "@/components/race/RemoteCar";
import type { LobbyPlayer } from "@/types/multiplayer";
// import { TestTrack } from "@/components/race/TestTrack"; // debug fallback

/* ------------------------------------------------------------------ */
/*  Car state type (shared between controller and camera)              */
/* ------------------------------------------------------------------ */

export type CarState = ChaseCarState extends infer T ? T : never;
// Alias — keep CarState name for backward compat with RacePageClient

/* ------------------------------------------------------------------ */
/*  RaceScene                                                          */
/* ------------------------------------------------------------------ */

type RaceSceneProps = {
  car: CarConfig;
  selectedCar: PlayerCar;
  track: TrackConfig;
  carRef?: React.MutableRefObject<CarState | null>;
  remotePlayers?: LobbyPlayer[];
  localSpawn?: { x: number; y?: number; z: number; yaw?: number };
};

export function RaceScene({ car, selectedCar, carRef, remotePlayers = [], localSpawn }: RaceSceneProps) {
  const gameplayStats = resolveCarGameplayStats(car, selectedCar);
  const internalCarRef = useRef<CarState | null>(null);
  const activeCarRef = carRef || internalCarRef;
  const initialPosition = localSpawn
    ? new THREE.Vector3(localSpawn.x, localSpawn.y ?? 0.3, localSpawn.z)
    : undefined;
  const initialRotationY = localSpawn?.yaw ?? undefined;

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

        {/* Racing circuit map */}
        <RaceMap />

        {/* Car controller wraps the car model, handles all movement */}
        <CarController
          stats={gameplayStats}
          carRef={activeCarRef}
          initialPosition={initialPosition}
          initialRotationY={initialRotationY}
        >
          <CarModel car={car} selectedCar={selectedCar} gameplayStats={gameplayStats} isDriving />
        </CarController>

        {/* Remote network cars interpolate their synced Colyseus state */}
        {remotePlayers.map((player) => (
          <RemoteCar key={player.sessionId} player={player} />
        ))}

        {/* Chase camera follows the car — uses tuned defaults */}
        <ChaseCamera carState={activeCarRef} />

        <Environment preset="night" />
      </Canvas>
    </div>
  );
}
