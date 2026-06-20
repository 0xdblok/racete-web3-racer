"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls, Html } from "@react-three/drei";
import type { CarConfig } from "@/config/cars";
import type { TrackConfig } from "@/config/tracks";
import type { PlayerCar } from "@/types/game";
import type { CarGameplayStats } from "@/lib/car-gameplay-stats";
import { resolveCarGameplayStats } from "@/lib/car-gameplay-stats";
import { CarModel } from "@/components/race/CarModel";

type RaceSceneProps = {
  car: CarConfig;
  selectedCar: PlayerCar;
  track: TrackConfig;
};

export function RaceScene({ car, selectedCar, track }: RaceSceneProps) {
  // Resolve final driving stats from base config + upgrade levels
  const gameplayStats = resolveCarGameplayStats(car, selectedCar);

  return (
    <div className="h-[calc(100vh-1rem)] min-h-[680px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#050509]">
      <Canvas camera={{ position: [7, 5, 9], fov: 48 }} shadows>
        <color attach="background" args={["#050509"]} />
        <fog attach="fog" args={["#050509", 18, 42]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[6, 10, 5]} intensity={2.2} castShadow />
        <pointLight position={[-4, 3, -6]} intensity={18} color="#d946ef" />
        <pointLight position={[5, 3, 5]} intensity={14} color="#bef264" />
        <PlaceholderTrack trackName={track.name} />
        <CarModel car={car} selectedCar={selectedCar} gameplayStats={gameplayStats} />

        {/* Debug: show resolved stats in-scene (remove when driving controller ready) */}
        <Html position={[-6, 3, -3]} style={{ pointerEvents: "none" }}>
          <div className="rounded-2xl border border-lime-300/25 bg-black/70 px-3 py-2 text-[10px] text-lime-200 backdrop-blur">
            <p className="font-black">Resolved gameplay stats</p>
            <p>maxSpeed: {gameplayStats.maxSpeed}</p>
            <p>accel: {gameplayStats.acceleration}</p>
            <p>brake: {gameplayStats.brakeForce}</p>
            <p>steer: {gameplayStats.steering}</p>
            <p>grip: {gameplayStats.grip}</p>
            <p>drift: {gameplayStats.driftFactor}</p>
            <p>nitroPwr: {gameplayStats.nitroPower}</p>
            <p>nitroDur: {gameplayStats.nitroDuration}s</p>
            <p>nitroCd: {gameplayStats.nitroCooldown}s</p>
          </div>
        </Html>

        <Environment preset="night" />
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.05} minDistance={5} maxDistance={16} />
      </Canvas>
    </div>
  );
}

function PlaceholderTrack({ trackName }: { trackName: string }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[34, 24]} />
        <meshStandardMaterial color="#111118" roughness={0.92} metalness={0.1} />
      </mesh>
      <Grid args={[34, 24]} cellSize={1} cellThickness={0.45} sectionSize={4} sectionThickness={1.2} cellColor="#262638" sectionColor="#d946ef" position={[0, 0.012, 0]} />
      <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[5.8, 8.2, 96]} />
        <meshStandardMaterial color="#181825" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[8.15, 8.35, 96]} />
        <meshStandardMaterial color="#bef264" emissive="#84cc16" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0, 0.08, -8.1]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[4, 0.28]} />
        <meshStandardMaterial color="#f0fdf4" emissive="#d9f99d" emissiveIntensity={0.25} />
      </mesh>
      <group position={[-6.5, 0.05, -9]}>
        <mesh>
          <boxGeometry args={[0.22, 0.1, 1.8]} />
          <meshStandardMaterial color="#d946ef" emissive="#d946ef" emissiveIntensity={0.7} />
        </mesh>
      </group>
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
