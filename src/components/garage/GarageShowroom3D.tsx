"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Clone, useGLTF, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CarConfig } from "@/config/cars";

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

// Per-car overrides — only for models that need tuning.
// No blanket rotation; cars use their natural model forward direction.
const CAR_OVERRIDES: Record<
  string,
  { rotationY?: number; scaleMultiplier?: number; positionOffset?: [number, number, number]; labelOffset?: [number, number, number] }
> = {};

// Bavaro Sport: model normalizes small, increase scale
CAR_OVERRIDES["bavaro-sport"] = { scaleMultiplier: 1.5 };

// Street Rat / Tesla Cybertruck: model pivot is off-center, nudge forward
CAR_OVERRIDES["street-rat"] = { positionOffset: [0, 0, 0.5] };

/* ------------------------------------------------------------------ */
/*  ShowroomCamera — OrbitControls with smooth focus transitions       */
/* ------------------------------------------------------------------ */

type FocusTarget = {
  pos: [number, number, number];
  lookAt: [number, number, number];
} | null;

function ShowroomCamera({ focus }: { focus: FocusTarget }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const desiredTarget = useRef(new THREE.Vector3(0, 1, 0));
  const animatedTarget = useRef(new THREE.Vector3(0, 1, 0));

  // When focus changes, snap desired and animate camera toward it
  useEffect(() => {
    if (focus && controlsRef.current) {
      desiredTarget.current.set(focus.lookAt[0], focus.lookAt[1], focus.lookAt[2]);
      animatedTarget.current.set(focus.lookAt[0], focus.lookAt[1], focus.lookAt[2]);

      // Move camera closer to the car over ~0.8s
      const targetCamPos = new THREE.Vector3(focus.pos[0], focus.pos[1], focus.pos[2]);
      const start = camera.position.clone();
      const startTarget = controlsRef.current.target.clone();
      const endTarget = new THREE.Vector3(focus.lookAt[0], focus.lookAt[1], focus.lookAt[2]);
      let elapsed = 0;
      const duration = 0.8;

      function animate() {
        elapsed += 1 / 60;
        const t = Math.min(elapsed / duration, 1.0);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
        camera.position.lerpVectors(start, targetCamPos, ease);
        controlsRef.current!.target.lerpVectors(startTarget, endTarget, ease);
        controlsRef.current!.update();
        if (t < 1) {
          requestAnimationFrame(animate);
        }
      }
      animate();
    } else {
      if (controlsRef.current) {
        // Fly back to overview
        const start = camera.position.clone();
        const startTarget = controlsRef.current.target.clone();
        const endTarget = new THREE.Vector3(0, 1, 0);
        const endCamPos = new THREE.Vector3(0, 12, 16);
        let elapsed = 0;
        const duration = 0.8;

        function animate() {
          elapsed += 1 / 60;
          const t = Math.min(elapsed / duration, 1.0);
          const ease = 1 - Math.pow(1 - t, 3);
          camera.position.lerpVectors(start, endCamPos, ease);
          if (controlsRef.current) {
            controlsRef.current.target.lerpVectors(startTarget, endTarget, ease);
            controlsRef.current.update();
          }
          if (t < 1) {
            requestAnimationFrame(animate);
          }
        }
        animate();
      }
    }
  }, [focus, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      minDistance={2.5}
      maxDistance={30}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2.2}
      enableDamping
      dampingFactor={0.08}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Floor grid                                                         */
/* ------------------------------------------------------------------ */

function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#1e1e28" roughness={0.4} metalness={0.1} />
      </mesh>
      <gridHelper args={[40, 40, "#2a2a3a", "#1a1a25"]} position={[0, 0, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Neon ring under car                                                */
/* ------------------------------------------------------------------ */

function NeonRing({
  position,
  color,
  radius = 1.6,
  opacity = 0.6,
}: {
  position: [number, number, number];
  color: string;
  radius?: number;
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.08, radius, 64]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={opacity} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Showroom car (clickable, hoverable, with model/placeholder)        */
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
  const [hovered, setHovered] = useState(false);
  const { gl } = useThree();

  const ringColor = isFocused
    ? "#a3e635"
    : hovered
      ? "#facc15"
      : isSelected
        ? "#a3e635"
        : isOwned
          ? "#e879f9"
          : "#ffffff22";

  const ringOpacity = isFocused ? 0.9 : hovered ? 0.7 : isSelected ? 0.6 : isOwned ? 0.5 : 0.2;
  const ringRadius = isFocused ? 1.8 : isSelected ? 1.6 : 1.2;

  const handlePointerOver = useCallback(() => {
    setHovered(true);
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
  }, []);

  // Sync cursor to hover state via effect (avoids direct DOM mutation lint error)
  useEffect(() => {
    // eslint-disable-next-line
    gl.domElement.style.cursor = hovered ? "pointer" : "auto";
  }, [hovered, gl]);

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onClick();
    },
    [onClick],
  );

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Neon ring */}
      <NeonRing position={[0, 0.02, 0]} color={ringColor} radius={ringRadius} opacity={ringOpacity} />

      {/* Car name label */}
      <Html
        position={[0, isFocused ? 3.8 : 2.8, 0]}
        center
        style={{ pointerEvents: "auto" }}
        onClick={handleClick}
      >
        <div
          className={`text-center whitespace-nowrap cursor-pointer select-none ${
            isFocused ? "scale-125" : hovered ? "scale-110" : ""
          }`}
        >
          <p
            className={`text-[10px] font-black ${
              isFocused
                ? "text-lime-300"
                : hovered
                  ? "text-yellow-200"
                  : isSelected
                    ? "text-lime-300"
                    : isOwned
                      ? "text-fuchsia-200"
                      : "text-white/60"
            }`}
          >
            {car.name}
          </p>
          <p className="text-[8px] text-white/30">{car.class}</p>
        </div>
      </Html>

      {/* Large clickable invisible hitbox (covers car + ring + label area) */}
      <mesh
        position={[0, 1.4, 0]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        visible={false}
      >
        <boxGeometry args={[4, 3, 6]} />
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
/*  CarModel with Box3 normalization + per-car overrides               */
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

  const baseScale = TARGET_SIZE / box.maxDim;
  const scale = baseScale * (override.scaleMultiplier ?? 1);
  const rotationY = override.rotationY ?? 0;
  const offset = override.positionOffset ?? [0, 0, 0];
  const floorY = -box.center.y * scale + box.size.y * 0.5 * scale;

  return (
    <group position={[offset[0], floorY + offset[1], offset[2]]} scale={scale} rotation-y={rotationY}>
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
      <Html position={[0, 1.2, 0]} center>
        <p className="text-[8px] text-amber-300/80 whitespace-nowrap font-bold">
          Model not uploaded yet
        </p>
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
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Lighting setup                                                     */
/* ------------------------------------------------------------------ */

function ShowroomLighting() {
  return (
    <>
      <ambientLight intensity={1.8} color="#ffffff" />
      <directionalLight position={[0, 10, 15]} intensity={3.5} color="#ffffff" />
      <directionalLight position={[-10, 5, -5]} intensity={1.5} color="#e0e0ff" />
      <directionalLight position={[10, 5, -5]} intensity={1.5} color="#ffe0e0" />
      <directionalLight position={[0, 3, -12]} intensity={2.0} color="#ffffff" />
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
  onBackToOverview: () => void;
};

export function GarageShowroom3D({
  cars,
  ownedCarIds,
  selectedCarId,
  focusedCarId,
  onCarClick,
  onBackToOverview,
}: GarageShowroom3DProps) {
  const focusTarget: FocusTarget = useMemo(() => {
    if (!focusedCarId) return null;
    const idx = cars.findIndex((c) => c.id === focusedCarId);
    if (idx < 0) return null;
    const pos = getCarPosition(idx);
    return {
      pos: [pos.x - 2.5, 2.5, pos.z + 6],
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
      {/* Back to overview overlay button (visible when focused) */}
      {focusedCarId && (
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={onBackToOverview}
            className="rounded-full border border-white/20 bg-black/60 backdrop-blur px-4 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors"
          >
            ← Back to showroom
          </button>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 12, 16], fov: 45, near: 0.5, far: 80 }}
        gl={{ antialias: true }}
        style={{ background: "transparent" }}
        // Canvas-level Escape key listener
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape" && focusedCarId) {
            onBackToOverview();
          }
        }}
        tabIndex={0}
      >
        <ShowroomLighting />
        <Floor />
        <ShowroomCamera focus={focusTarget} />

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
