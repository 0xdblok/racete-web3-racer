"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";
import { useInViewport, tryAcquireCanvasSlot, releaseCanvasSlot } from "@/lib/useInViewport";

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
const hasModel = (car: CarConfig) => Boolean(car.modelUrl);

/* ------------------------------------------------------------------ */
/*  Canvas3D — isolated 3D preview (only mounted when slot available)  */
/* ------------------------------------------------------------------ */

function Canvas3D({ modelUrl, carId, accent }: { modelUrl: string; carId: string; accent: string }) {
  useEffect(() => {
    return () => releaseCanvasSlot();
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 1.5, 4.5], fov: 40 }}
      gl={{ antialias: false }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 6, 4]} intensity={1.5} />
      <Suspense fallback={<LoadingPlaceholder accent={accent} />}>
        <GltfBoundary fallback={<FallbackMesh accent={accent} />}>
          <LoadedModel modelUrl={modelUrl} carId={carId} />
        </GltfBoundary>
      </Suspense>
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/*  CanvasSlot — conditionally mounts Canvas3D when slot is acquired   */
/* ------------------------------------------------------------------ */

function CanvasSlot({ car, accent }: { car: CarConfig; accent: string }) {
  // Try once on mount; never re-try for this component instance
  const acquired = useRef(false);
  const [, setMounted] = useState(false);

  useEffect(() => {
    if (tryAcquireCanvasSlot()) {
      acquired.current = true;
      setMounted(true);
    }
    return () => {
      if (acquired.current) {
        releaseCanvasSlot();
      }
    };
  }, []);

  if (!acquired.current) {
    // Couldn't get a WebGL slot — show fallback
    return <Silhouette car={car} />;
  }

  return (
    <CanvasErrorBoundary fallback={<Silhouette car={car} />}>
      <Canvas3D modelUrl={car.modelUrl} carId={car.id} accent={accent} />
    </CanvasErrorBoundary>
  );
}

/* ------------------------------------------------------------------ */
/*  Error boundaries                                                   */
/* ------------------------------------------------------------------ */

class CanvasErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.warn("Canvas error boundary caught:", error.message); }
  componentWillUnmount() { releaseCanvasSlot(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

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
/*  LazyCarPreview (main export)                                       */
/* ------------------------------------------------------------------ */

export function LazyCarPreview({ car, ownedCar }: CardPreviewProps) {
  const { ref, inView } = useInViewport();
  const [show3D, setShow3D] = useState(false);
  const accent = getAccent(car.class);

  // No model → always 2D silhouette, no Canvas ever
  if (!hasModel(car)) {
    return (
      <div ref={ref} className="h-52 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black overflow-hidden relative flex items-center justify-center">
        <Silhouette car={car} />
        <p className="absolute bottom-2 text-[10px] font-bold text-amber-300/80">Model not uploaded yet</p>
      </div>
    );
  }

  const shouldRenderCanvas = inView || show3D;

  if (!shouldRenderCanvas) {
    // Out of viewport and not manually clicked → 2D silhouette
    return (
      <div ref={ref} className="h-52 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black overflow-hidden relative">
        <Silhouette car={car} />
        <button
          onClick={() => setShow3D(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 cursor-pointer"
        >
          <span className="text-xs text-white/50 hover:text-white/80 font-bold">Load 3D</span>
        </button>
      </div>
    );
  }

  // In viewport or clicked → try to render Canvas (with slot limiting)
  return (
    <div ref={ref} className="h-52 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black overflow-hidden relative">
      <CanvasSlot car={car} accent={accent} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components (unchanged)                                         */
/* ------------------------------------------------------------------ */

function Silhouette({ car }: { car: CarConfig }) {
  const accent = getAccent(car.class);
  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      <svg viewBox="0 0 120 40" className="w-full max-w-[180px] opacity-30">
        <rect x="10" y="22" width="100" height="12" rx="3" fill={accent} />
        <rect x="25" y="8" width="70" height="16" rx="6" fill={accent} />
        <circle cx="30" cy="34" r="6" fill={accent} />
        <circle cx="90" cy="34" r="6" fill={accent} />
      </svg>
      <p className="mt-2 text-xs text-white/30 font-bold">{car.name}</p>
      <p className="text-[10px] text-white/20">Class {car.class}</p>
    </div>
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
