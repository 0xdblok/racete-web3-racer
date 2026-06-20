"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";
import { useInViewport, tryAcquireCanvasSlot, releaseCanvasSlot } from "@/lib/useInViewport";

type CardPreviewProps = {
  car: CarConfig;
  ownedCar?: PlayerCar;
};

const hasModel = (car: CarConfig) => Boolean(car.modelUrl);

/* ------------------------------------------------------------------ */
/*  Per-car overrides (only needed when auto-fit isn't enough)         */
/* ------------------------------------------------------------------ */

type CarOverride = {
  rotationY?: number;
  scaleMultiplier?: number;
  yOffset?: number;
};

const CAR_OVERRIDES: Record<string, CarOverride> = {
  // bavaro-coupe model is huge (~160m) → auto-fit handles it
  // but some models may need rotation tweaks
  "bavaro-coupe": { rotationY: Math.PI },
  "toro-x": { rotationY: Math.PI },
  "furia-gt": { rotationY: Math.PI },
  "nova-s1": { rotationY: Math.PI },
  "bavaro-sport": { rotationY: Math.PI },
  "zephyr-z8": { rotationY: Math.PI },
  "bavaro-m5": { rotationY: Math.PI },
  "toro-se": { rotationY: Math.PI },
  "valor-gt": { rotationY: Math.PI },
  "warp-x1": { rotationY: Math.PI },
  "nova-spider": { rotationY: Math.PI },
  "volt-w6": { rotationY: Math.PI },
  "volt-c5": { rotationY: Math.PI },
  "bavaro-cs": { rotationY: Math.PI },
  "street-rat": { rotationY: Math.PI },
};

/* ------------------------------------------------------------------ */
/*  Auto-normalization: Box3 → center, scale, floor                    */
/* ------------------------------------------------------------------ */

const TARGET_SIZE = 3.0; // normalized max dimension in world units

function computeBox(scene: THREE.Group): { center: THREE.Vector3; size: THREE.Vector3; maxDim: number } {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  return { center, size, maxDim };
}

/* ------------------------------------------------------------------ */
/*  Canvas3D — isolated 3D preview (only mounted when slot available)  */
/* ------------------------------------------------------------------ */

function Canvas3D({ modelUrl, carId, accent }: { modelUrl: string; carId: string; accent: string }) {
  useEffect(() => {
    return () => releaseCanvasSlot();
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 1.6, 5.2], fov: 38 }}
      gl={{ antialias: true }}
      style={{ background: "transparent" }}
    >
      {/* Brighter 3-point lighting */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 5, 5]} intensity={2.0} />
      <directionalLight position={[-3, 2, -2]} intensity={0.8} />
      <directionalLight position={[0, 1, -4]} intensity={0.5} />

      {/* Light floor to see dark cars */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#1a1a20" roughness={0.6} metalness={0.1} />
      </mesh>

      <Suspense fallback={<LoadingPlaceholder accent={accent} />}>
        <GltfBoundary fallback={<FallbackMesh accent={accent} />}>
          <NormalizedModel modelUrl={modelUrl} carId={carId} accent={accent} />
        </GltfBoundary>
      </Suspense>
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/*  NormalizedModel — auto-fit + debug overlay                         */
/* ------------------------------------------------------------------ */

type NormalizeState =
  | { status: "computing" }
  | { status: "ready"; scale: number; maxDim: number; size: THREE.Vector3 }
  | { status: "failed"; reason: string };

function NormalizedModel({ modelUrl, carId, accent }: { modelUrl: string; carId: string; accent: string }) {
  const gltf = useGLTF(modelUrl);
  const [normalizeState, setNormalizeState] = useState<NormalizeState>({ status: "computing" });

  const override = CAR_OVERRIDES[carId] ?? {};

  useEffect(() => {
    try {
      // Clone scene to compute Box3 without modifying original
      const clone = gltf.scene.clone(true);
      const { center, maxDim } = computeBox(clone);

      if (maxDim <= 0 || !isFinite(maxDim)) {
        setNormalizeState({ status: "failed", reason: "Empty bounding box" });
        return;
      }

      const scale = TARGET_SIZE / maxDim;
      // Debug: log normalization for founder verification
      console.debug(`[Normalize] ${carId}: maxDim=${maxDim.toFixed(2)}, scale=${scale.toFixed(4)}, rawScale=${scale.toFixed(4)}${override.scaleMultiplier ? `, multiplier=${override.scaleMultiplier}` : ""}`);
      setNormalizeState({
        status: "ready",
        scale,
        maxDim,
        size: new THREE.Vector3(), // not needed for positioning, stored for debug
      });
    } catch (err) {
      setNormalizeState({ status: "failed", reason: err instanceof Error ? err.message : "Box3 failed" });
    }
  }, [gltf]);

  const box = useMemo(() => {
    if (normalizeState.status !== "ready") return null;
    return computeBox(gltf.scene);
  }, [gltf, normalizeState]);

  if (normalizeState.status === "failed") {
    return <FallbackMesh accent={accent} />;
  }

  if (normalizeState.status === "computing" || !box) {
    return <LoadingPlaceholder accent={accent} />;
  }

  const { scale } = normalizeState;
  const finalScale = scale * (override.scaleMultiplier ?? 1);
  const rotationY = override.rotationY ?? 0;
  const yOffset = override.yOffset ?? 0;

  // Floor the model: bottom of bounding box sits at y=0
  const floorY = -box.center.y * finalScale + box.size.y * 0.5 * finalScale + yOffset;

  return (
    <group>
      <group
        position={[0, floorY, 0]}
        scale={finalScale}
        rotation-y={rotationY}
      >
        <Clone object={gltf.scene} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  CanvasSlot — conditionally mounts Canvas3D when slot is acquired   */
/* ------------------------------------------------------------------ */

function CanvasSlot({ car, accent }: { car: CarConfig; accent: string }) {
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

  return (
    <div ref={ref} className="h-52 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black overflow-hidden relative">
      <CanvasSlot car={car} accent={accent} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
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
