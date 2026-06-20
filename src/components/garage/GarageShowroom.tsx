"use client";

import React, { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clone, OrbitControls, Environment, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";

const SHOWROOM_SLOTS: { carId: string; position: [number, number, number]; rotation: [number, number, number] }[] = [
  { carId: "street-rat", position: [-8, 0, -3], rotation: [0, Math.PI * 0.15, 0] },
  { carId: "bavaro-coupe", position: [-4.8, 0, -2.5], rotation: [0, Math.PI * 0.08, 0] },
  { carId: "aurox-v10", position: [-1.6, 0, -2], rotation: [0, 0, 0] },
  { carId: "sturm-rs", position: [1.6, 0, -2], rotation: [0, -Math.PI * 0.08, 0] },
  { carId: "furia-gt", position: [4.8, 0, -2.5], rotation: [0, -Math.PI * 0.15, 0] },
  { carId: "toro-x", position: [8, 0, -3], rotation: [0, -Math.PI * 0.2, 0] },
];

const CAR_SHOWROOM_CONFIG: Record<string, { scale: number; positionOffset: [number, number, number]; rotationOffset: [number, number, number] }> = {
  "street-rat": { scale: 0.55, positionOffset: [0, 0.25, 0], rotationOffset: [0, 0, 0] },
  "bavaro-coupe": { scale: 1.4, positionOffset: [0, 0.05, 0], rotationOffset: [0, 0, 0] },
  "furia-gt": { scale: 1.3, positionOffset: [0, 0.15, 0], rotationOffset: [0, 0, 0] },
  "toro-x": { scale: 0.85, positionOffset: [0, 0.35, 0], rotationOffset: [0, 0, 0] },
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
  devToolsEnabled,
}: {
  cars: CarConfig[];
  ownedCarIds: Set<string>;
  selectedCarId: string | null;
  focusedCarId: string | null;
  onCarClick: (carId: string) => void;
  devToolsEnabled: boolean;
}) {
  return (
    <div className="h-full w-full">
      <Canvas shadows camera={{ position: [0, 3, 10], fov: 50 }} gl={{ antialias: true, alpha: false }} style={{ background: "#0a0a0f" }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 12, 8]} intensity={1.5} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <directionalLight position={[-8, 8, -6]} intensity={0.6} />
        <pointLight position={[0, 6, 0]} intensity={0.8} color="#f0e6ff" />
        <pointLight position={[-8, 4, -3]} intensity={0.4} color="#d946ef" />
        <pointLight position={[8, 4, -3]} intensity={0.4} color="#d946ef" />
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[40, 20]} />
          <meshStandardMaterial color="#0f0f14" roughness={0.6} metalness={0.3} />
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
              devToolsEnabled={devToolsEnabled}
            />
          );
        })}

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={4}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.2}
          target={[0, 1, -2]}
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
  devToolsEnabled,
}: {
  car: CarConfig;
  position: [number, number, number];
  rotation: [number, number, number];
  owned: boolean;
  selected: boolean;
  focused: boolean;
  onClick: () => void;
  devToolsEnabled: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  const hasModel = isModelAvailable(car);
  const config = CAR_SHOWROOM_CONFIG[car.id];
  const scale = config?.scale ?? 1;
  const posOffset = config?.positionOffset ?? [0, 0, 0];
  const rotOffset = config?.rotationOffset ?? [0, 0, 0];

  const statusColor = selected ? "#bef264" : owned ? "#d946ef" : "#71717a";

  return (
    <group
      ref={groupRef}
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
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.8, 0.04, 32]} />
        <meshStandardMaterial
          color={focused ? "#2a2a35" : hovered ? "#1e1e28" : "#14141a"}
          roughness={0.4}
          metalness={0.6}
          emissive={focused ? statusColor : "#000000"}
          emissiveIntensity={focused ? 0.3 : 0}
        />
      </mesh>

      {/* Status ring */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.65, 1.75, 64]} />
        <meshBasicMaterial color={statusColor} transparent opacity={focused ? 0.8 : hovered ? 0.5 : 0.25} />
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

      {/* Label */}
      <Html position={[0, 2.8, 0]} center distanceFactor={8}>
        <div className="pointer-events-none select-none text-center">
          <div className={`rounded-full px-3 py-1 text-xs font-black ${selected ? "bg-lime-300 text-black" : owned ? "bg-fuchsia-300 text-black" : "bg-white/10 text-white/70"}`}>
            {car.name}
          </div>
          {!hasModel && (
            <div className="mt-1 text-[10px] font-bold text-amber-300">Model not uploaded yet</div>
          )}
          {devToolsEnabled && (
            <div className="mt-1 text-[9px] text-white/40">
              {car.id} · {hasModel ? "loaded" : "fallback"}
            </div>
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
    for (let x = -12; x <= 12; x += 2) {
      result.push({ start: [x, 0.01, -6], end: [x, 0.01, 2] });
    }
    for (let z = -6; z <= 2; z += 2) {
      result.push({ start: [-12, 0.01, z], end: [12, 0.01, z] });
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
          new THREE.LineBasicMaterial({ color: "#1a1a24" })
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
