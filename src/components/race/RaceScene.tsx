"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import type { CarConfig } from "@/config/cars";
import type { TrackConfig } from "@/config/tracks";
import type { PlayerCar } from "@/types/game";

type RaceSceneProps = {
  car: CarConfig;
  selectedCar: PlayerCar;
  track: TrackConfig;
};

export function RaceScene({ car, selectedCar, track }: RaceSceneProps) {
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
        <PlaceholderCar car={car} selectedCar={selectedCar} />
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

function PlaceholderCar({ car, selectedCar }: { car: CarConfig; selectedCar: PlayerCar }) {
  const accent = car.class === "S" || car.class === "A" ? "#f97316" : car.class.startsWith("B") ? "#d946ef" : "#84cc16";
  return (
    <group position={[0, 0.55, -5.8]} rotation-y={Math.PI}>
      <mesh castShadow>
        <boxGeometry args={[2.3, 0.55, 4.2]} />
        <meshStandardMaterial color="#18181b" roughness={0.35} metalness={0.65} />
      </mesh>
      <mesh position={[0, 0.45, -0.35]} castShadow>
        <boxGeometry args={[1.45, 0.5, 1.55]} />
        <meshStandardMaterial color="#27272a" roughness={0.25} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0.14, -2.16]}>
        <boxGeometry args={[1.55, 0.12, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, 0.78, 1.9]}>
        <boxGeometry args={[1.65, 0.08, 0.35]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} />
      </mesh>
      {[[-1.22, -0.18, -1.35], [1.22, -0.18, -1.35], [-1.22, -0.18, 1.35], [1.22, -0.18, 1.35]].map(([x, y, z]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} rotation-z={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.26, 24]} />
          <meshStandardMaterial color="#050505" roughness={0.55} metalness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[2.2, 0.04, 0.04]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[Math.min(3.6, selectedCar.power_rating / 110), 0.04, 0.04]} />
        <meshBasicMaterial color="#bef264" />
      </mesh>
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
