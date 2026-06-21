"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CheckpointConfig } from "@/config/tracks";

/* ------------------------------------------------------------------ */
/*  Checkpoint gate visuals                                            */
/* ------------------------------------------------------------------ */

type CheckpointGatesProps = {
  checkpoints: CheckpointConfig[];
  expectedCheckpointIndex: number;
  phase: "waiting" | "countdown" | "racing" | "finished";
};

export function CheckpointGates({ checkpoints, expectedCheckpointIndex, phase }: CheckpointGatesProps) {
  // Highlight the next checkpoint the race loop expects, not the last one crossed.
  const activeIndex = phase === "finished" ? 0 : expectedCheckpointIndex;

  return (
    <group>
      {checkpoints.map((cp, idx) => {
        const isActive = idx === activeIndex;
        const isStartFinish = !!cp.isFinish;
        return (
          <CheckpointRing
            key={cp.id}
            cp={cp}
            isActive={isActive}
            isStartFinish={isStartFinish}
          />
        );
      })}
    </group>
  );
}

function CheckpointRing({
  cp,
  isActive,
  isStartFinish,
}: {
  cp: CheckpointConfig;
  isActive: boolean;
  isStartFinish: boolean;
}) {
  const torusRef = useRef<THREE.Mesh>(null);
  const baseColor = isStartFinish ? "#f472b6" : isActive ? "#bef264" : "#22d3ee";
  const emissive = isStartFinish ? "#db2777" : isActive ? "#84cc16" : "#0891b2";

  useFrame((_, delta) => {
    if (!torusRef.current) return;
    if (isActive) {
      torusRef.current.rotation.z += delta * 1.2;
      torusRef.current.rotation.y += delta * 0.3;
    }
  });

  // Ring radius scales with checkpoint radius so it spans the road.
  const ringRadius = Math.max(6, cp.radius * 0.65);
  const tubeRadius = isActive ? 0.35 : 0.18;

  return (
    <group position={[cp.x, 3.5, cp.z]}>
      <mesh ref={torusRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ringRadius, tubeRadius, 16, 64]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissive}
          emissiveIntensity={isActive ? 1.6 : 0.4}
          transparent
          opacity={isActive ? 0.9 : 0.35}
        />
      </mesh>

      {/* Vertical pillars */}
      <Pillar x={-ringRadius} color={baseColor} opacity={isActive ? 0.7 : 0.25} />
      <Pillar x={ringRadius} color={baseColor} opacity={isActive ? 0.7 : 0.25} />

      {/* Floating label */}
      {isActive && cp.label && (
        <BillboardText text={cp.label} color={baseColor} />
      )}
    </group>
  );
}

function Pillar({ x, color, opacity }: { x: number; color: string; opacity: number }) {
  return (
    <mesh position={[x, -1.5, 0]}>
      <cylinderGeometry args={[0.12, 0.12, 3, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={opacity} />
    </mesh>
  );
}

function BillboardText({ text, color }: { text: string; color: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 48px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, color]);

  return (
    <mesh position={[0, 1.8, 0]}>
      <planeGeometry args={[8, 2]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}
