"use client";

import React, { Suspense } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";

type CarModelProps = {
  car: CarConfig;
  selectedCar: PlayerCar;
};

export function CarModel({ car, selectedCar }: CarModelProps) {
  return (
    <Suspense fallback={<FallbackCar car={car} selectedCar={selectedCar} loading />}>
      <ModelOrFallback car={car} selectedCar={selectedCar} />
    </Suspense>
  );
}

function ModelOrFallback({ car, selectedCar }: CarModelProps) {
  if (!car.modelUrl) return <FallbackCar car={car} selectedCar={selectedCar} />;
  return (
    <GltfCarBoundary fallback={<FallbackCar car={car} selectedCar={selectedCar} />}>
      <LoadedGltfCar car={car} selectedCar={selectedCar} />
    </GltfCarBoundary>
  );
}

function LoadedGltfCar({ car, selectedCar }: CarModelProps) {
  const gltf = useGLTF(car.modelUrl);
  const scale = getModelScale(car.id);
  const rotationY = getModelRotationY(car.id);

  return (
    <group position={[0, 0.18, -5.8]} rotation-y={rotationY} scale={scale}>
      <Clone object={gltf.scene} castShadow receiveShadow />
      <PowerBar car={car} selectedCar={selectedCar} />
    </group>
  );
}

function FallbackCar({ car, selectedCar, loading = false }: CarModelProps & { loading?: boolean }) {
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
        <meshStandardMaterial color={loading ? "#fef08a" : accent} emissive={loading ? "#facc15" : accent} emissiveIntensity={1.2} />
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
      <PowerBar car={car} selectedCar={selectedCar} />
    </group>
  );
}

function PowerBar({ car, selectedCar }: CarModelProps) {
  const accent = car.class === "S" || car.class === "A" ? "#f97316" : car.class.startsWith("B") ? "#d946ef" : "#84cc16";
  return (
    <group position={[0, 1.05, 0]}>
      <mesh>
        <boxGeometry args={[2.2, 0.04, 0.04]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[Math.min(3.6, selectedCar.power_rating / 110), 0.04, 0.04]} />
        <meshBasicMaterial color="#bef264" />
      </mesh>
    </group>
  );
}

function getModelScale(carId: string) {
  if (carId === "bavaro-coupe") return 0.06;
  if (carId === "toro-x") return 0.85;
  if (carId === "aurox-v10") return 0.9;
  return 1;
}

function getModelRotationY(carId: string) {
  if (carId === "toro-x") return Math.PI;
  if (carId === "aurox-v10") return Math.PI;
  return Math.PI;
}

class GltfCarBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Fallback keeps the race shell usable when local GLB files are not present yet.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
