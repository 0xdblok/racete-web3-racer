"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  Huge Test Track — 1500×1500 driving arena with long straights,      */
/*  wide oval, drift zone, slalom, distance markers                     */
/* ------------------------------------------------------------------ */

export function TestTrack() {
  return (
    <group>
      {/* Ground — dark asphalt */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[1500, 1500]} />
        <meshStandardMaterial color="#1a1a24" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Track surface */}
      <TrackSurface />

      {/* Boundary walls */}
      <BoundaryWalls />

      {/* Direction arrows and markers */}
      <TrackMarkers />

      {/* Slalom cones */}
      <SlalomZone />

      {/* Drift zone */}
      <DriftZone />

      {/* Start/finish complex */}
      <StartFinishComplex />

      {/* Distance markers */}
      <DistanceMarkers />

      {/* Reference light posts */}
      <LightPosts />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Track surface                                                       */
/* ------------------------------------------------------------------ */

function TrackSurface() {
  const STRAIGHT_LENGTH = 500;
  const TRACK_WIDTH = 20;

  return (
    <group>
      {/* Main straight (north-south, from z=-250 to z=250) */}
      <RoadStrip x={0} z={0} width={TRACK_WIDTH} length={STRAIGHT_LENGTH} />

      {/* North turn (wide oval) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 250]} receiveShadow>
        <ringGeometry args={[60, 60 + TRACK_WIDTH, 80, 1, 0, Math.PI]} />
        <meshStandardMaterial color="#2a2a38" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Return straight (parallel, offset east) */}
      <RoadStrip x={70} z={0} width={TRACK_WIDTH} length={STRAIGHT_LENGTH} />

      {/* South turn (wide oval) */}
      <mesh rotation-x={-Math.PI / 2} position={[35, 0.01, -250]} receiveShadow>
        <ringGeometry args={[35, 35 + TRACK_WIDTH, 80, 1, 0, Math.PI]} />
        <meshStandardMaterial color="#2a2a38" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Cross strips for lane changes */}
      <RoadStrip x={35} z={-125} width={TRACK_WIDTH} length={60} />
      <RoadStrip x={35} z={125} width={TRACK_WIDTH} length={60} />

      {/* Extended high-speed test straight (long straight east of the oval) */}
      <RoadStrip x={140} z={0} width={18} length={600} />
    </group>
  );
}

function RoadStrip({
  x,
  z,
  width,
  length,
}: {
  x: number;
  z: number;
  width: number;
  length: number;
}) {
  return (
    <group position={[x, 0.01, z]}>
      {/* Road surface */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#2a2a38" roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Edge lines */}
      {[-width / 2 + 0.3, width / 2 - 0.3].map((ex) => (
        <mesh key={ex} rotation-x={-Math.PI / 2} position={[ex, 0.01, 0]}>
          <planeGeometry args={[0.3, length]} />
          <meshBasicMaterial color="#ffffff" opacity={0.4} transparent />
        </mesh>
      ))}
      {/* Center dashed line */}
      <DashedLine position={[0, 0.02, -length / 2]} count={Math.floor(length / 8)} />
    </group>
  );
}

function DashedLine({
  position,
  count,
}: {
  position: [number, number, number];
  count: number;
}) {
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          rotation-x={-Math.PI / 2}
          position={[(i % 2) * 0.001, 0, i * 8 + 4]}
        >
          <planeGeometry args={[0.2, 3.5]} />
          <meshBasicMaterial color="#ffffff" opacity={0.3} transparent />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Boundary walls (arena limits at ±750)                               */
/* ------------------------------------------------------------------ */

function BoundaryWalls() {
  const halfX = 740;
  const halfZ = 740;
  const wallH = 2;
  const wallColor = "#d946ef";
  const wallOpacity = 0.12;

  return (
    <group>
      <Wall pos={[0, wallH / 2, -halfZ]} size={[halfX * 2, wallH, 0.5]} color={wallColor} opacity={wallOpacity} />
      <Wall pos={[0, wallH / 2, halfZ]} size={[halfX * 2, wallH, 0.5]} color={wallColor} opacity={wallOpacity} />
      <Wall pos={[-halfX, wallH / 2, 0]} size={[0.5, wallH, halfZ * 2]} color={wallColor} opacity={wallOpacity} />
      <Wall pos={[halfX, wallH / 2, 0]} size={[0.5, wallH, halfZ * 2]} color={wallColor} opacity={wallOpacity} />
    </group>
  );
}

function Wall({
  pos,
  size,
  color,
  opacity,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} opacity={opacity} transparent roughness={0.5} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Track markers                                                       */
/* ------------------------------------------------------------------ */

function TrackMarkers() {
  return (
    <group>
      {/* Forward arrows along main straight */}
      {[
        [0, -200], [0, -150], [0, -100], [0, -50],
        [0, 50], [0, 100], [0, 150], [0, 200],
      ].map(([x, z], i) => (
        <Arrow key={`a-${i}`} x={x} z={z} />
      ))}

      {/* North curve arrows */}
      {[
        [-20, 240], [-35, 250], [-50, 260],
        [-55, 280], [-50, 300], [-35, 310],
      ].map(([x, z], i) => (
        <Arrow key={`nc-${i}`} x={x} z={z} />
      ))}

      {/* Return straight arrows (southbound) */}
      {[
        [70, 200], [70, 150], [70, 100], [70, 50],
        [70, -50], [70, -100], [70, -150], [70, -200],
      ].map(([x, z], i) => (
        <Arrow key={`rs-${i}`} x={x} z={z} rotZ={Math.PI} />
      ))}

      {/* High-speed straight arrows */}
      {[
        [140, -250], [140, -150], [140, -50],
        [140, 50], [140, 150], [140, 250],
      ].map(([x, z], i) => (
        <Arrow key={`hs-${i}`} x={x} z={z} />
      ))}
    </group>
  );
}

function Arrow({ x, z, rotZ = 0 }: { x: number; z: number; rotZ?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, rotZ]} position={[x, 0.03, z]}>
      <planeGeometry args={[1.5, 3]} />
      <meshBasicMaterial color="#bef264" opacity={0.35} transparent />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Slalom zone (cones on the high-speed straight)                      */
/* ------------------------------------------------------------------ */

function SlalomZone() {
  const cones: [number, number][] = [];
  // Slalom on the high-speed straight
  for (let i = 0; i < 20; i++) {
    const z = -200 + i * 25;
    cones.push([140 + (i % 2 === 0 ? -4 : 4), z]);
  }
  // Slalom on main straight
  for (let i = 0; i < 15; i++) {
    const z = -350 + i * 18;
    cones.push([(i % 2 === 0 ? -4 : 4), z]);
  }

  return (
    <group>
      {cones.map(([x, z], i) => (
        <Cone key={`sl-${i}`} x={x} z={z} />
      ))}
    </group>
  );
}

function Cone({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.35, z]} castShadow>
      <coneGeometry args={[0.25, 0.7, 8]} />
      <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} roughness={0.4} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Drift zone (large open paved area)                                  */
/* ------------------------------------------------------------------ */

function DriftZone() {
  return (
    <group>
      {/* Open drift pad at northwest corner */}
      <mesh rotation-x={-Math.PI / 2} position={[-200, 0.01, -300]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#22222e" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Drift zone border */}
      <mesh rotation-x={-Math.PI / 2} position={[-200, 0.02, -300]}>
        <ringGeometry args={[90, 92, 64]} />
        <meshBasicMaterial color="#d946ef" opacity={0.4} transparent />
      </mesh>
      {/* "DRIFT ZONE" label proxy — ring of cones */}
      {[
        [-200, -390], [-160, -360], [-120, -340], [-200, -210], [-160, -240], [-120, -260],
      ].map(([x, z], i) => (
        <Cone key={`dz-${i}`} x={x} z={z} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Start / finish complex                                              */
/* ------------------------------------------------------------------ */

function StartFinishComplex() {
  return (
    <group>
      {/* Checkered start line at z=0 on main straight */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-4.5 + i, 0.025, 0]}>
          <planeGeometry args={[0.9, 1.5]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#ffffff" : "#111111"} />
        </mesh>
      ))}

      {/* START banner */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, -1]} scale={[6, 1, 1]}>
        <planeGeometry args={[1, 1.5]} />
        <meshBasicMaterial color="#bef264" />
      </mesh>

      {/* Checkered line on return straight */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={`rs-${i}`} rotation-x={-Math.PI / 2} position={[65.5 + i, 0.025, 0]}>
          <planeGeometry args={[0.9, 1.5]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#ffffff" : "#111111"} />
        </mesh>
      ))}

      {/* Checkered line on high-speed straight */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={`hs-${i}`} rotation-x={-Math.PI / 2} position={[136 + i, 0.025, 0]}>
          <planeGeometry args={[0.9, 1.5]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#ffffff" : "#111111"} />
        </mesh>
      ))}

      {/* Start position markers (glowing dots at z=0) */}
      {[-4, -2, 0, 2, 4].map((x) => (
        <mesh key={`sp-${x}`} position={[x, 0.06, 4]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.15, 0.3, 16]} />
          <meshBasicMaterial color="#bef264" />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Distance markers                                                    */
/* ------------------------------------------------------------------ */

function DistanceMarkers() {
  // Every 100m along main straight and high-speed straight
  const markers: [number, number, string][] = [];
  for (let z = -300; z <= 400; z += 100) {
    markers.push([-12, z, `${Math.abs(z)}m`]);
    markers.push([152, z, `${Math.abs(z)}m`]);
  }

  return (
    <group>
      {markers.map(([x, z, label], i) => (
        <DistanceMarker key={`dm-${i}`} x={x} z={z} label={label} />
      ))}
    </group>
  );
}

function DistanceMarker({ x, z, label }: { x: number; z: number; label: string }) {
  return (
    <group position={[x, 0.03, z]}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[label.length * 0.4, 1]} />
        <meshBasicMaterial color="#ffffff" opacity={0.2} transparent />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Light posts (visual reference points)                               */
/* ------------------------------------------------------------------ */

function LightPosts() {
  const posts: [number, number][] = [];
  // Grid of posts across the arena
  for (let x = -600; x <= 600; x += 200) {
    for (let z = -600; z <= 600; z += 200) {
      if (Math.abs(x) < 80 && Math.abs(z) < 400) continue; // skip track area
      posts.push([x, z]);
    }
  }

  return (
    <group>
      {posts.map(([x, z], i) => (
        <group key={`lp-${i}`} position={[x, 2, z]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 4, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.4} roughness={0.3} />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={1.2} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
