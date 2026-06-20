"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";

/* ------------------------------------------------------------------ */
/*  Auto-normalization (shared via StaticCarPreview)                  */
/* ------------------------------------------------------------------ */

const TARGET_SIZE = 3.5; // slightly larger for the hero showroom

function computeBox(scene: THREE.Group) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  return { center, size, maxDim };
}

type CarOverride = { rotationY?: number; scaleMultiplier?: number; yOffset?: number };

const CAR_OVERRIDES: Record<string, CarOverride> = {};
// Default rotationY=PI for all cars (rear-facing view)
for (const id of [
  "street-rat","bavaro-coupe","aurox-v10","sturm-rs","furia-gt","toro-x",
  "nova-s1","bavaro-sport","zephyr-z8","bavaro-m5","toro-se","valor-gt",
  "warp-x1","nova-spider","volt-w6","volt-c5","bavaro-cs",
]) {
  CAR_OVERRIDES[id] = { rotationY: Math.PI };
}

/* ------------------------------------------------------------------ */
/*  ShowroomModel — loads 1 GLTF, normalizes, renders                  */
/* ------------------------------------------------------------------ */

function ShowroomModel({ car }: { car: CarConfig }) {
  if (!car.modelUrl) {
    return <Silhouette3D accent={getAccent(car.class)} />;
  }

  return (
    <Suspense fallback={<LoadingSpinner accent={getAccent(car.class)} />}>
      <GltfBoundary fallback={<Silhouette3D accent={getAccent(car.class)} />}>
        <NormalizedShowroomCar car={car} />
      </GltfBoundary>
    </Suspense>
  );
}

function NormalizedShowroomCar({ car }: { car: CarConfig }) {
  const gltf = useGLTF(car.modelUrl);
  const override = CAR_OVERRIDES[car.id] ?? {};

  const box = useMemo(() => computeBox(gltf.scene), [gltf]);
  const scale = TARGET_SIZE / box.maxDim;
  const finalScale = scale * (override.scaleMultiplier ?? 1);
  const rotationY = override.rotationY ?? 0;
  const yOffset = override.yOffset ?? 0;
  const floorY = -box.center.y * finalScale + box.size.y * 0.5 * finalScale + yOffset;

  return (
    <group position={[0, floorY, 0]} scale={finalScale} rotation-y={rotationY}>
      <Clone object={gltf.scene} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Fallbacks                                                          */
/* ------------------------------------------------------------------ */

function Silhouette3D({ accent }: { accent: string }) {
  return (
    <group position={[0, 0.6, 0]}>
      <mesh>
        <boxGeometry args={[2.2, 0.6, 4.0]} />
        <meshStandardMaterial color="#18181b" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.48, -0.4]}>
        <boxGeometry args={[1.4, 0.55, 1.6]} />
        <meshStandardMaterial color="#27272a" roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.15, -2.1]}>
        <boxGeometry args={[1.5, 0.12, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
      </mesh>
      {/* Wheels */}
      {[[-1.15, -0.18, -1.3],[1.15, -0.18, -1.3],[-1.15, -0.18, 1.3],[1.15, -0.18, 1.3]].map(([x, y, z]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} rotation-z={Math.PI/2}>
          <cylinderGeometry args={[0.32, 0.32, 0.24, 20]} />
          <meshStandardMaterial color="#050505" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function LoadingSpinner({ accent }: { accent: string }) {
  return (
    <group position={[0, 0.6, 0]}>
      <mesh>
        <boxGeometry args={[2.2, 0.6, 4.0]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.5} metalness={0.5} opacity={0.5} transparent />
      </mesh>
      <mesh position={[0, 0.15, -2.1]}>
        <boxGeometry args={[1.5, 0.12, 0.08]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Error Boundaries                                                   */
/* ------------------------------------------------------------------ */

class GltfBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/* ------------------------------------------------------------------ */
/*  HeroShowroom (public export)                                       */
/* ------------------------------------------------------------------ */

type HeroShowroomProps = {
  car: CarConfig | null;
  carName?: string;
  className?: string;
};

export function HeroShowroom({ car, carName, className = "" }: HeroShowroomProps) {
  if (!car) {
    return (
      <div className={`rounded-[2rem] border border-white/10 bg-[#0a0a12] p-8 flex items-center justify-center min-h-[320px] ${className}`}>
        <p className="text-white/40 text-lg">Select a car to preview</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[2rem] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_center,#1a1030,transparent_60%),#0a0a12] overflow-hidden relative min-h-[320px] ${className}`}>
      <Canvas
        camera={{ position: [0, 1.8, 6.0], fov: 35 }}
        gl={{ antialias: true }}
        style={{ background: "transparent" }}
      >
        {/* 3-point lighting */}
        <ambientLight intensity={1.4} />
        <directionalLight position={[5, 6, 6]} intensity={2.2} />
        <directionalLight position={[-4, 3, -3]} intensity={0.9} />
        <directionalLight position={[0, 1, -5]} intensity={0.5} />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
          <planeGeometry args={[14, 14]} />
          <meshStandardMaterial color="#1a1a22" roughness={0.5} metalness={0.15} />
        </mesh>

        <ShowroomModel car={car} />
      </Canvas>

      {/* Overlay label */}
      {carName && (
        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
          <p className="text-lg font-black text-white/90 drop-shadow-lg">{carName}</p>
          <p className="text-sm text-white/50">Class {car.class} · PR {car.basePowerRating}</p>
        </div>
      )}
    </div>
  );
}

export function HeroShowroomPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[2rem] border border-white/10 bg-[#0a0a12] p-8 flex items-center justify-center min-h-[320px] ${className}`}>
      <div className="text-center">
        <p className="text-white/30 text-sm">Connect your wallet</p>
        <p className="text-white/20 text-xs mt-1">to preview cars in 3D</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAccent(carClass: string) {
  if (carClass === "S" || carClass === "A") return "#f97316";
  if (carClass.startsWith("B")) return "#d946ef";
  return "#84cc16";
}
