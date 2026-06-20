"use client";

import React, { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clone, OrbitControls, useGLTF, Environment } from "@react-three/drei";
import type { Group } from "three";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";

type GarageCarPreviewProps = {
  car: CarConfig;
  selectedCar?: PlayerCar | null;
};

export function GarageCarPreview({ car, selectedCar }: GarageCarPreviewProps) {
  return (
    <div className="h-64 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black overflow-hidden">
      <Canvas shadows camera={{ position: [4, 2.5, 5], fov: 35 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 3]} intensity={1.2} castShadow />
        <directionalLight position={[-3, 4, -5]} intensity={0.4} />
        <Suspense fallback={<FallbackPreview car={car} selectedCar={selectedCar} loading />}>
          <GltfPreviewBoundary fallback={<FallbackPreview car={car} selectedCar={selectedCar} />}>
            <LoadedPreviewCar car={car} selectedCar={selectedCar} />
          </GltfPreviewBoundary>
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={10}
          autoRotate
          autoRotateSpeed={1.5}
          target={[0, 0.3, 0]}
        />
        <Environment preset="city" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#0a0a0f" roughness={0.8} metalness={0.2} />
        </mesh>
      </Canvas>
    </div>
  );
}

function LoadedPreviewCar({ car, selectedCar }: GarageCarPreviewProps) {
  const gltf = useGLTF(car.modelUrl);
  const scale = getPreviewScale(car.id);
  const rotationY = getPreviewRotationY(car.id);
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.2;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.3, 0]} rotation-y={rotationY} scale={scale}>
      <Clone object={gltf.scene} castShadow receiveShadow />
      <PowerBarPreview car={car} selectedCar={selectedCar} />
    </group>
  );
}

function FallbackPreview({ car, selectedCar, loading = false }: GarageCarPreviewProps & { loading?: boolean }) {
  const accent = car.class === "S" || car.class === "A" ? "#f97316" : car.class.startsWith("B") ? "#d946ef" : "#84cc16";
  const isMissing = !car.modelUrl || car.modelUrl.endsWith(".glb");
  
  return (
    <group position={[0, 0.55, 0]} rotation-y={Math.PI}>
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
      {isMissing && (
        <mesh position={[0, 1.4, 0]}>
          <planeGeometry args={[3, 0.6]} />
          <meshBasicMaterial color="#transparent" transparent opacity={0} />
        </mesh>
      )}
      <PowerBarPreview car={car} selectedCar={selectedCar} />
    </group>
  );
}

function PowerBarPreview({ car, selectedCar }: GarageCarPreviewProps) {
  const accent = car.class === "S" || car.class === "A" ? "#f97316" : car.class.startsWith("B") ? "#d946ef" : "#84cc16";
  const powerRating = selectedCar?.power_rating || car.basePowerRating;
  return (
    <group position={[0, 1.05, 0]}>
      <mesh>
        <boxGeometry args={[2.2, 0.04, 0.04]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[Math.min(3.6, powerRating / 110), 0.04, 0.04]} />
        <meshBasicMaterial color="#bef264" />
      </mesh>
    </group>
  );
}

function getPreviewScale(carId: string) {
  if (carId === "bavaro-coupe") return 0.06;
  if (carId === "toro-x") return 0.85;
  if (carId === "aurox-v10") return 0.9;
  return 1;
}

function getPreviewRotationY(carId: string) {
  if (carId === "toro-x") return Math.PI;
  if (carId === "aurox-v10") return Math.PI;
  return Math.PI;
}

class GltfPreviewBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {}

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
