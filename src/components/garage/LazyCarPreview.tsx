"use client";

import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";
import { useInViewport } from "@/lib/useInViewport";

type CardPreviewProps = {
  car: CarConfig;
  ownedCar?: PlayerCar;
};

const SCALES: Record<string, number> = {
  "bavaro-coupe": 0.06,
  "toro-x": 0.85,
  "street-rat": 0.55,
  "furia-gt": 0.7,
};

function getScale(carId: string) { return SCALES[carId] ?? 1; }

export function LazyCarPreview({ car, ownedCar }: CardPreviewProps) {
  const { ref, inView } = useInViewport();
  const [show3D, setShow3D] = useState(false);
  const load3D = inView || show3D;

  return (
    <div ref={ref} className="h-56 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black overflow-hidden relative">
      {load3D ? (
        <Canvas camera={{ position: [0, 1.5, 4.5], fov: 40 }} gl={{ antialias: false }} style={{ background: "transparent" }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 6, 4]} intensity={1.5} />
          <Suspense fallback={<LoadingPlaceholder accent={getAccent(car.class)} />}>
            <ModelOrFallback car={car} />
          </Suspense>
        </Canvas>
      ) : (
        <button onClick={() => setShow3D(true)} className="absolute inset-0 flex items-center justify-center text-sm text-white/40 hover:text-white/70 cursor-pointer">
          Load 3D preview
        </button>
      )}
    </div>
  );
}

function ModelOrFallback({ car }: { car: CarConfig }) {
  if (!car.modelUrl) return <FallbackMesh accent={getAccent(car.class)} />;

  return (
    <GltfBoundary fallback={<FallbackMesh accent={getAccent(car.class)} />}>
      <LoadedModel modelUrl={car.modelUrl} carId={car.id} />
    </GltfBoundary>
  );
}

function LoadedModel({ modelUrl, carId }: { modelUrl: string; carId: string }) {
  const gltf = useGLTF(modelUrl);
  const scale = getScale(carId);
  return (
    <group position={[0, 0.2, 0]} scale={scale} rotation-y={Math.PI}>
      <Clone object={gltf.scene} />
    </group>
  );
}

function FallbackMesh({ accent }: { accent: string }) {
  return (
    <group position={[0, 0.55, 0]}>
      <mesh>
        <boxGeometry args={[2, 0.45, 3.8]} />
        <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.35, -0.3]}>
        <boxGeometry args={[1.3, 0.4, 1.4]} />
        <meshStandardMaterial color="#27272a" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.14, -1.9]}>
        <boxGeometry args={[1.4, 0.1, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function LoadingPlaceholder({ accent }: { accent: string }) {
  return (
    <group position={[0, 0.55, 0]}>
      <mesh>
        <boxGeometry args={[2, 0.45, 3.8]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.5} metalness={0.5} opacity={0.6} transparent />
      </mesh>
      <mesh position={[0, 0.14, -1.9]}>
        <boxGeometry args={[1.4, 0.1, 0.06]} />
        <meshStandardMaterial color="#fef08a" emissive="#facc15" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function getAccent(carClass: string) {
  if (carClass === "S" || carClass === "A") return "#f97316";
  if (carClass.startsWith("B")) return "#d946ef";
  return "#84cc16";
}

class GltfBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
