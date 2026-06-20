"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";
import type { TrackConfig } from "@/config/tracks";
import type { PlayerCar } from "@/types/game";
import type { CarGameplayStats } from "@/lib/car-gameplay-stats";
import { resolveCarGameplayStats } from "@/lib/car-gameplay-stats";
import { CarController } from "@/components/race/CarController";
import { ChaseCamera } from "@/components/race/ChaseCamera";
import { CarModel } from "@/components/race/CarModel";

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

export function RaceScene({ car, selectedCar, track, carRef }: RaceSceneProps) {
  const gameplayStats = resolveCarGameplayStats(car, selectedCar);
  const internalCarRef = useRef<CarState | null>(null);
  const activeCarRef = carRef || internalCarRef;

  return (
    <div className="h-[calc(100vh-1rem)] min-h-[680px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#050509]">
      <Canvas camera={{ position: [0, 5, 12], fov: 55 }} shadows>
        <color attach="background" args={["#050509"]} />
        <fog attach="fog" args={["#050509", 30, 60]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[6, 10, 5]} intensity={2.2} castShadow />
        <pointLight position={[-4, 3, -6]} intensity={18} color="#d946ef" />
        <pointLight position={[5, 3, 5]} intensity={14} color="#bef264" />

        <PlaceholderTrack trackName={track.name} />

        {/* Car controller wraps the car model, handles all movement */}
        <CarController stats={gameplayStats} carRef={activeCarRef}>
          <CarModel car={car} selectedCar={selectedCar} gameplayStats={gameplayStats} isDriving />
        </CarController>

        {/* Chase camera follows the car */}
        <ChaseCamera carState={activeCarRef} distance={7} height={3.5} smoothness={3} />

        <Environment preset="night" />
      </Canvas>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PlaceholderTrack                                                    */
/* ------------------------------------------------------------------ */

function PlaceholderTrack({ trackName }: { trackName: string }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 30]} />
        <meshStandardMaterial color="#111118" roughness={0.92} metalness={0.1} />
      </mesh>
      <Grid args={[40, 30]} cellSize={1} cellThickness={0.45} sectionSize={4} sectionThickness={1.2} cellColor="#262638" sectionColor="#d946ef" position={[0, 0.012, 0]} />
      <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[5.8, 8.2, 96]} />
        <meshStandardMaterial color="#181825" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[8.15, 8.35, 96]} />
        <meshStandardMaterial color="#bef264" emissive="#84cc16" emissiveIntensity={0.4} />
      </mesh>
      <TextBillboard label={trackName} />
    </group>
  );
}

function TextBillboard({ label }: { label: string }) {
  return (
    <group position={[0, 0.12, 8.8]}>
      <mesh>
        <boxGeometry args={[5.4, 0.08, 0.35]} />
        <meshStandardMaterial color="#d946ef" emissive="#d946ef" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[label.length * 0.16, 0.04, 0.08]} />
        <meshStandardMaterial color="#bef264" emissive="#bef264" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}
