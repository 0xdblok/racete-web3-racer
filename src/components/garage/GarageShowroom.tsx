"use client";

import React, { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Clone, OrbitControls, Environment, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";

const SHOWROOM_SLOTS: { carId: string; position: [number, number, number]; rotation: [number, number, number] }[] = [
  { carId: "street-rat", position: [-10, 0, 0], rotation: [0, 0.3, 0] },
  { carId: "bavaro-coupe", position: [-6, 0, 0], rotation: [0, 0.15, 0] },
  { carId: "aurox-v10", position: [-2, 0, 0], rotation: [0, 0, 0] },
  { carId: "sturm-rs", position: [2, 0, 0], rotation: [0, -0.15, 0] },
  { carId: "furia-gt", position: [6, 0, 0], rotation: [0, -0.3, 0] },
  { carId: "toro-x", position: [10, 0, 0], rotation: [0, -0.4, 0] },
];

const CAR_SHOWROOM_CONFIG: Record<string, { scale: number; positionOffset: [number, number, number]; rotationOffset: [number, number, number] }> = {
  "street-rat": { scale: 0.35, positionOffset: [0, 0.3, 0], rotationOffset: [0, 0, 0] },
  "bavaro-coupe": { scale: 0.08, positionOffset: [0, 0.05, 0], rotationOffset: [0, 0, 0] },
  "furia-gt": { scale: 0.45, positionOffset: [0, 0.15, 0], rotationOffset: [0, 0, 0] },
  "toro-x": { scale: 0.4, positionOffset: [0, 0.35, 0], rotationOffset: [0, 0, 0] },
};

function isModelAvailable(car: CarConfig): boolean {
  return Boolean(car.modelUrl && car.modelUrl.includes("/scene.gltf"));
}

export function GarageShowroom({
  cars,
  ownedCarIds,
  selectedCarId,
  focusedCarId,
  onCarClick,
}: {
  cars: CarConfig[];
  ownedCarIds: Set<string>;
  selectedCarId: string | null;
  focusedCarId: string | null;
  onCarClick: (carId: string) => void;
}) {
  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        camera={{ position: [0, 5, 20], fov: 65 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "#111118" }}
      >
        {/* Bright ambient light so everything is visible */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[0, 15, 10]} intensity={2.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <directionalLight position={[-15, 10, -5]} intensity={1.2} />
        <directionalLight position={[15, 10, -5]} intensity={1.2} />
        <pointLight position={[0, 6, 5]} intensity={2} color="#ffffff" />

        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        {/* Floor - brighter */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[50, 25]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.5} />
        </mesh>

        {/* Back wall for depth */}
        <mesh position={[0, 4, -8]} receiveShadow>
          <planeGeometry args={[50, 10]} />
          <meshStandardMaterial color="#16162a" roughness={0.5} metalness={0.4} />
        </mesh>

        {/* Showroom grid lines */}
        <ShowroomGrid />

        {/* Car slots */}
        {SHOWROOM_SLOTS.map((slot) => {
          const car = cars.find((c) => c.id === slot.carId);
          if (!car) return null;
          const owned = ownedCarIds.has(car.id);
          const selected = selectedCarId === car.id;
          const focused = focusedCarId === car.id;
          return (
            <CarSlot
              key={car.id}
              car={car}
              position={slot.position}
              rotation={slot.rotation}
              owned={owned}
              selected={selected}
              focused={focused}
              onClick={() => onCarClick(car.id)}
            />
          );
        })}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={5}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.3}
          target={[0, 1.2, 0]}
        />
      </Canvas>
    </div>
  );
}

function CarSlot({
  car,
  position,
  rotation,
  owned,
  selected,
  focused,
  onClick,
}: {
  car: CarConfig;
  position: [number, number, number];
  rotation: [number, number, number];
  owned: boolean;
  selected: boolean;
  focused: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hasModel = isModelAvailable(car);
  const config = CAR_SHOWROOM_CONFIG[car.id];
  const scale = config?.scale ?? 0.4;
  const posOffset = config?.positionOffset ?? [0, 0.2, 0];
  const rotOffset = config?.rotationOffset ?? [0, 0, 0];

  const statusColor = selected ? "#bef264" : owned ? "#d946ef" : "#71717a";

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Platform */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[2.2, 2.4, 0.06, 32]} />
        <meshStandardMaterial
          color={focused ? "#3a3a45" : hovered ? "#2a2a35" : "#1c1c28"}
          roughness={0.3}
          metalness={0.7}
          emissive={focused ? statusColor : "#000000"}
          emissiveIntensity={focused ? 0.25 : 0}
        />
      </mesh>

      {/* Status ring */}
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.25, 2.35, 64]} />
        <meshBasicMaterial color={statusColor} transparent opacity={focused ? 0.9 : hovered ? 0.6 : 0.3} />
      </mesh>

      {/* Spotlight cone */}
      <mesh position={[0, 4, 0]}>
        <cylinderGeometry args={[0.3, 2.8, 4, 16, 1, true]} />
        <meshBasicMaterial color={focused ? statusColor : "#ffffff"} transparent opacity={focused ? 0.12 : hovered ? 0.06 : 0.02} depthWrite={false} />
      </mesh>

      {/* Car model or fallback */}
      <group position={posOffset} rotation={rotOffset} scale={scale}>
        {hasModel ? (
          <Suspense fallback={<FallbackMesh car={car} />}>
            <GltfCarBoundary fallback={<FallbackMesh car={car} />}>
              <LoadedCarModel modelUrl={car.modelUrl} />
            </GltfCarBoundary>
          </Suspense>
        ) : (
          <FallbackMesh car={car} />
        )}
      </group>

      {/* Label - high above the car so it doesn't block it */}
      <Html position={[0, 3.5, 0]} center distanceFactor={12}>
        <div className="pointer-events-none select-none text-center whitespace-nowrap">
          <div className={`rounded-full px-4 py-1.5 text-sm font-black ${selected ? "bg-lime-400 text-black" : owned ? "bg-fuchsia-400 text-black" : "bg-white/15 text-white/80"}`}>
            {car.name}
          </div>
          <div className="mt-1 text-xs font-bold text-white/50">Class {car.class} · PR {car.basePowerRating}</div>
          {!hasModel && (
            <div className="mt-1 text-[10px] font-bold text-amber-300">Model not uploaded yet</div>
          )}
        </div>
      </Html>
    </group>
  );
}

function LoadedCarModel({ modelUrl }: { modelUrl: string }) {
  const gltf = useGLTF(modelUrl);
  return <Clone object={gltf.scene} castShadow receiveShadow />;
}

function FallbackMesh({ car }: { car: CarConfig }) {
  const accent = car.class === "S" || car.class === "A" ? "#f97316" : car.class.startsWith("B") ? "#d946ef" : "#84cc16";
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
    </group>
  );
}

function ShowroomGrid() {
  const lines = useMemo(() => {
    const result: { start: [number, number, number]; end: [number, number, number] }[] = [];
    for (let x = -12; x <= 12; x += 2.5) {
      result.push({ start: [x, 0.01, -4], end: [x, 0.01, 4] });
    }
    for (let z = -4; z <= 4; z += 2) {
      result.push({ start: [-12.5, 0.01, z], end: [12.5, 0.01, z] });
    }
    return result;
  }, []);

  return (
    <group>
      {lines.map((line, i) => (
        <primitive key={i} object={new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...line.start),
            new THREE.Vector3(...line.end),
          ]),
          new THREE.LineBasicMaterial({ color: "#25253a" })
        )} />
      ))}
    </group>
  );
}

class GltfCarBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
