"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Clone, useGLTF, Html, Text } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";

/* ------------------------------------------------------------------ */
/*  Layout: arc arrangement (4 rows, spacing)                          */
/* ------------------------------------------------------------------ */

const ROWS: { z: number; count: number }[] = [
  { z: -6, count: 4 },
  { z: -2, count: 5 },
  { z: 2, count: 4 },
  { z: 6, count: 4 },
];

const X_SPACING = 4.5;

function getCarPosition(index: number): { x: number; z: number } {
  let offset = 0;
  for (const row of ROWS) {
    if (index < offset + row.count) {
      const slot = index - offset;
      const totalWidth = (row.count - 1) * X_SPACING;
      const x = -totalWidth / 2 + slot * X_SPACING;
      return { x, z: row.z };
    }
    offset += row.count;
  }
  return { x: 0, z: 0 };
}

/* ------------------------------------------------------------------ */
/*  Auto-normalization (shared logic)                                  */
/* ------------------------------------------------------------------ */

const TARGET_SIZE = 2.5;

function computeBox(scene: THREE.Group) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  return { center, size, maxDim };
}

const CAR_OVERRIDES: Record<string, { rotationY?: number }> = {};
for (const id of [
  "street-rat","bavaro-coupe","furia-gt","toro-x",
  "nova-s1","bavaro-sport","zephyr-z8","bavaro-m5","toro-se","valor-gt",
  "warp-x1","nova-spider","volt-w6","volt-c5","bavaro-cs",
]) {
  CAR_OVERRIDES[id] = { rotationY: Math.PI };
}

/* ------------------------------------------------------------------ */
/*  Camera controller (smooth zoom to focused car)                     */
/* ------------------------------------------------------------------ */

type FocusTarget = { pos: [number, number, number]; lookAt: [number, number, number] } | null;

function CameraController({ focus }: { focus: FocusTarget }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 12, 16));
  const targetLook = useRef(new THREE.Vector3(0, 1, 0));

  useEffect(() => {
    if (focus) {
      targetPos.current.set(...focus.pos);
      targetLook.current.set(...focus.lookAt);
    } else {
      targetPos.current.set(0, 12, 16);
      targetLook.current.set(0, 1, 0);
    }
  }, [focus]);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-4 * delta);
    camera.position.lerp(targetPos.current, t);
    const currentLook = new THREE.Vector3();
    camera.getWorldDirection(currentLook);
    const desiredDir = targetLook.current.clone().sub(camera.position).normalize();
    const lerpedDir = currentLook.lerp(desiredDir, t).normalize();
    const lookTarget = camera.position.clone().add(lerpedDir.multiplyScalar(5));
    camera.lookAt(lookTarget);
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Floor grid                                                         */
/* ------------------------------------------------------------------ */

function Floor() {
  return (
    <group>
      {/* Light floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#1e1e28" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Subtle grid lines */}
      <gridHelper args={[40, 40, "#2a2a3a", "#1a1a25"]} position={[0, 0, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Neon ring under focused/selected car                               */
/* ------------------------------------------------------------------ */

function NeonRing({ position, color, radius = 1.6 }: { position: [number, number, number]; color: string; radius?: number }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.08, radius, 64]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.6} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Single showroom car (lazy loaded, Suspense isolated)               */
/* ------------------------------------------------------------------ */

function ShowroomCar({
  car,
  position,
  isSelected,
  isOwned,
  isFocused,
  onClick,
}: {
  car: CarConfig;
  position: { x: number; z: number };
  isSelected: boolean;
  isOwned: boolean;
  isFocused: boolean;
  onClick: () => void;
}) {
  const hasModel = Boolean(car.modelUrl);

  const ringColor = isSelected ? "#a3e635" : isOwned ? "#e879f9" : "#ffffff22";
  const ringRadius = isFocused ? 1.8 : isSelected ? 1.6 : 1.2;

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Neon ring */}
      <NeonRing position={[0, 0.02, 0]} color={ringColor} radius={ringRadius} />

      {/* Car name label */}
      <Html position={[0, isFocused ? 3.5 : 2.5, 0]} center style={{ pointerEvents: "none" }}>
        <div className={`text-center whitespace-nowrap ${isFocused ? "scale-125" : ""}`}>
          <p className={`text-[10px] font-black ${isSelected ? "text-lime-300" : isOwned ? "text-fuchsia-200" : "text-white/60"}`}>
            {car.name}
          </p>
          <p className="text-[8px] text-white/30">{car.class}</p>
        </div>
      </Html>

      {/* Clickable invisible mesh for raycasting */}
      <mesh
        position={[0, 1.2, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        visible={false}
      >
        <boxGeometry args={[3, 2.4, 5]} />
        <meshBasicMaterial />
      </mesh>

      {/* Car model or fallback */}
      <Suspense fallback={<PlaceholderMesh accent={getAccent(car.class)} />}>
        <CarModelOrFallback car={car} />
      </Suspense>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  CarModel with Box3 normalization                                  */
/* ------------------------------------------------------------------ */

function CarModelOrFallback({ car }: { car: CarConfig }) {
  if (!car.modelUrl) {
    return <PlaceholderMesh accent={getAccent(car.class)} />;
  }

  return (
    <GltfErrorBoundary fallback={<PlaceholderMesh accent={getAccent(car.class)} />}>
      <NormalizedCarModel car={car} />
    </GltfErrorBoundary>
  );
}

function NormalizedCarModel({ car }: { car: CarConfig }) {
  const gltf = useGLTF(car.modelUrl);
  const override = CAR_OVERRIDES[car.id] ?? {};
  const box = useMemo(() => computeBox(gltf.scene), [gltf]);

  const scale = TARGET_SIZE / box.maxDim;
  const rotationY = override.rotationY ?? 0;
  const floorY = -box.center.y * scale + box.size.y * 0.5 * scale;

  return (
    <group position={[0, floorY, 0]} scale={scale} rotation-y={rotationY}>
      <Clone object={gltf.scene} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder for missing/broken models                              */
/* ------------------------------------------------------------------ */

function PlaceholderMesh({ accent }: { accent: string }) {
  return (
    <group position={[0, 0.5, 0]}>
      <mesh>
        <boxGeometry args={[2, 0.5, 3.5]} />
        <meshStandardMaterial color="#18181b" roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.4, -0.3]}>
        <boxGeometry args={[1.3, 0.45, 1.4]} />
        <meshStandardMaterial color="#27272a" roughness={0.25} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, -1.8]}>
        <boxGeometry args={[1.3, 0.1, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.5} />
      </mesh>
      {/* Missing model text */}
      <Html position={[0, 1.2, 0]} center>
        <p className="text-[8px] text-amber-300/80 whitespace-nowrap font-bold">Model not uploaded yet</p>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Error boundary                                                     */
/* ------------------------------------------------------------------ */

class GltfErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/* ------------------------------------------------------------------ */
/*  Lighting setup                                                     */
/* ------------------------------------------------------------------ */

function ShowroomLighting() {
  return (
    <>
      {/* Strong ambient for overall visibility */}
      <ambientLight intensity={1.8} color="#ffffff" />
      {/* Key light from front-top */}
      <directionalLight position={[0, 10, 15]} intensity={3.5} color="#ffffff" />
      {/* Fill from left */}
      <directionalLight position={[-10, 5, -5]} intensity={1.5} color="#e0e0ff" />
      {/* Fill from right */}
      <directionalLight position={[10, 5, -5]} intensity={1.5} color="#ffe0e0" />
      {/* Rim/back light to separate dark cars */}
      <directionalLight position={[0, 3, -12]} intensity={2.0} color="#ffffff" />
      {/* Top-down soft */}
      <directionalLight position={[0, 10, 0]} intensity={0.8} color="#ffffff" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  GarageShowroom3D (public export)                                   */
/* ------------------------------------------------------------------ */

export type ShowroomCarClick = {
  car: CarConfig;
  isSelected: boolean;
  isOwned: boolean;
};

type GarageShowroom3DProps = {
  cars: CarConfig[];
  ownedCarIds: Set<string>;
  selectedCarId: string | null;
  focusedCarId: string | null;
  onCarClick: (info: ShowroomCarClick) => void;
};

export function GarageShowroom3D({
  cars,
  ownedCarIds,
  selectedCarId,
  focusedCarId,
  onCarClick,
}: GarageShowroom3DProps) {
  const focusTarget: FocusTarget = useMemo(() => {
    if (!focusedCarId) return null;
    const idx = cars.findIndex((c) => c.id === focusedCarId);
    if (idx < 0) return null;
    const pos = getCarPosition(idx);
    return {
      pos: [pos.x, 2.5, pos.z + 6],
      lookAt: [pos.x, 0.8, pos.z],
    };
  }, [focusedCarId, cars]);

  const handleClick = useCallback(
    (car: CarConfig) => {
      onCarClick({
        car,
        isSelected: car.id === selectedCarId,
        isOwned: ownedCarIds.has(car.id),
      });
    },
    [onCarClick, selectedCarId, ownedCarIds],
  );

  return (
    <div className="w-full h-full min-h-[500px] md:min-h-[600px] rounded-[2rem] border border-white/10 bg-[#0c0c16] overflow-hidden relative">
      <Canvas
        camera={{ position: [0, 12, 16], fov: 45, near: 0.5, far: 80 }}
        gl={{ antialias: true }}
        style={{ background: "transparent" }}
      >
        <ShowroomLighting />
        <Floor />
        <CameraController focus={focusTarget} />

        <group>
          {cars.map((car, index) => {
            const pos = getCarPosition(index);
            const isSelected = car.id === selectedCarId;
            const isOwned = ownedCarIds.has(car.id);
            const isFocused = car.id === focusedCarId;
            return (
              <ShowroomCar
                key={car.id}
                car={car}
                position={pos}
                isSelected={isSelected}
                isOwned={isOwned}
                isFocused={isFocused}
                onClick={() => handleClick(car)}
              />
            );
          })}
        </group>
      </Canvas>
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
