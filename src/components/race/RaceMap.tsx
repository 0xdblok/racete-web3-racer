"use client";

import React, { useMemo } from "react";

/* ================================================================== */
/*  RaceMap — Procedural neon night racing circuit                      */
/*  2000×2000 playable area, closed-loop track with environment props   */
/* ================================================================== */

/* ── Track path (waypoints defining the circuit) ── */
// Circuit goes clockwise: start at z=0, go north, east, south, return west
const TRACK_PATH: [number, number][] = [
  [0, -80],     // Start/finish area
  [0, 200],     // North straight
  [40, 300],    // North-east curve
  [120, 340],
  [220, 320],   // East straight
  [320, 260],
  [380, 180],   // South-east curve
  [380, 0],
  [340, -120],  // South curve
  [260, -220],
  [140, -260],  // South-west curve
  [0, -240],
  [-80, -180],  // West curve
  [-120, -80],
  [-80, 0],     // Return to start
  [0, -80],
];

const TRACK_WIDTH = 14;  // road width
const WORLD_HALF = 500;  // world boundary radius

/* ================================================================== */
/*  Main component                                                      */
/* ================================================================== */

export function RaceMap() {
  const roadSegments = useMemo(() => buildRoadSegments(TRACK_PATH), []);

  return (
    <group>
      {/* Ground */}
      <Ground />

      {/* Road surface */}
      {roadSegments.map((seg, i) => (
        <RoadSegment key={`road-${i}`} seg={seg} />
      ))}

      {/* Road edge lines */}
      {roadSegments.map((seg, i) => (
        <EdgeLines key={`edge-${i}`} seg={seg} />
      ))}

      {/* Start / finish line */}
      <StartFinishLine />

      {/* Guardrails */}
      <Guardrails roadSegments={roadSegments} />

      {/* Environment props */}
      <TrackLights roadSegments={roadSegments} />
      <Trees />
      <Rocks />
      <Billboards />

      {/* World boundary walls */}
      <WorldBounds />
    </group>
  );
}

/* ================================================================== */
/*  Types + road builder                                                */
/* ================================================================== */

type RoadSegmentData = {
  start: [number, number];
  end: [number, number];
  length: number;
  angle: number;      // radians
  dirX: number;        // normalized direction
  dirZ: number;
  perpX: number;       // perpendicular (road width direction)
  perpZ: number;
};

function buildRoadSegments(path: [number, number][]): RoadSegmentData[] {
  const segs: RoadSegmentData[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [x1, z1] = path[i];
    const [x2, z2] = path[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) continue;
    segs.push({
      start: [x1, z1],
      end: [x2, z2],
      length: len,
      angle: Math.atan2(dx, dz),
      dirX: dx / len,
      dirZ: dz / len,
      perpX: -dz / len,
      perpZ: dx / len,
    });
  }
  return segs;
}

/* ================================================================== */
/*  Ground                                                              */
/* ================================================================== */

function Ground() {
  return (
    <group>
      {/* Main ground — dark dirt/grass */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#0d1117" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Outer accent ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
        <ringGeometry args={[490, 500, 128]} />
        <meshStandardMaterial color="#1a1025" roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  Road segments                                                       */
/* ================================================================== */

function RoadSegment({ seg }: { seg: RoadSegmentData }) {
  const centerX = (seg.start[0] + seg.end[0]) / 2;
  const centerZ = (seg.start[1] + seg.end[1]) / 2;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, seg.angle]}
      position={[centerX, 0.015, centerZ]}
      receiveShadow
    >
      <planeGeometry args={[TRACK_WIDTH, seg.length]} />
      <meshStandardMaterial color="#1e1e2e" roughness={0.55} metalness={0.2} />
    </mesh>
  );
}

function EdgeLines({ seg }: { seg: RoadSegmentData }) {
  const centerX = (seg.start[0] + seg.end[0]) / 2;
  const centerZ = (seg.start[1] + seg.end[1]) / 2;

  return (
    <group rotation={[-Math.PI / 2, 0, seg.angle]} position={[centerX, 0.025, centerZ]}>
      {/* Left edge (white solid) */}
      <mesh position={[-TRACK_WIDTH / 2 + 0.2, 0, 0]}>
        <planeGeometry args={[0.3, seg.length]} />
        <meshBasicMaterial color="#ffffff" opacity={0.5} transparent />
      </mesh>
      {/* Right edge (white solid) */}
      <mesh position={[TRACK_WIDTH / 2 - 0.2, 0, 0]}>
        <planeGeometry args={[0.3, seg.length]} />
        <meshBasicMaterial color="#ffffff" opacity={0.5} transparent />
      </mesh>
      {/* Center dashed line (on straights only) */}
      {seg.length > 60 && <CenterDash length={seg.length} />}
    </group>
  );
}

function CenterDash({ length }: { length: number }) {
  const count = Math.floor(length / 5);
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[0, 0, -length / 2 + i * 5 + 2.5]} visible={i % 2 === 0}>
          <planeGeometry args={[0.2, 2.5]} />
          <meshBasicMaterial color="#ffffff" opacity={0.3} transparent />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Start / Finish line                                                 */
/* ================================================================== */

function StartFinishLine() {
  // Start line at z=-80, spanning the road width (-7 to +7)
  const z = -80;
  return (
    <group>
      {/* Checkered line */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-6.5 + i, 0.04, z]}>
          <planeGeometry args={[0.9, 1.8]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#ffffff" : "#111111"} />
        </mesh>
      ))}

      {/* Start position markers (glowing dots) */}
      {[-4, -2, 0, 2, 4].map((x) => (
        <mesh key={`sp-${x}`} position={[x, 0.07, z + 5]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.2, 0.4, 16]} />
          <meshBasicMaterial color="#bef264" />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Guardrails                                                          */
/* ================================================================== */

function Guardrails({ roadSegments }: { roadSegments: RoadSegmentData[] }) {
  const railH = 0.8;
  const railColor = "#d946ef";
  const railOpacity = 0.3;

  return (
    <group>
      {roadSegments.map((seg, i) => {
        const postCount = Math.floor(seg.length / 4);
        return (
          <group key={`rail-${i}`}>
            {Array.from({ length: postCount + 1 }).map((_, p) => {
              const t = p / Math.max(postCount, 1);
              const px = seg.start[0] + seg.dirX * seg.length * t + seg.perpX * (TRACK_WIDTH / 2 + 1);
              const pz = seg.start[1] + seg.dirZ * seg.length * t + seg.perpZ * (TRACK_WIDTH / 2 + 1);
              const nx = seg.start[0] + seg.dirX * seg.length * t - seg.perpX * (TRACK_WIDTH / 2 + 1);
              const nz = seg.start[1] + seg.dirZ * seg.length * t - seg.perpZ * (TRACK_WIDTH / 2 + 1);
              return (
                <React.Fragment key={p}>
                  {p % 2 === 0 && (
                    <>
                      <mesh position={[px, railH / 2, pz]}>
                        <cylinderGeometry args={[0.15, 0.15, railH, 8]} />
                        <meshStandardMaterial color={railColor} emissive={railColor} emissiveIntensity={0.4} roughness={0.3} />
                      </mesh>
                      <mesh position={[nx, railH / 2, nz]}>
                        <cylinderGeometry args={[0.15, 0.15, railH, 8]} />
                        <meshStandardMaterial color={railColor} emissive={railColor} emissiveIntensity={0.4} roughness={0.3} />
                      </mesh>
                    </>
                  )}
                  {/* Rail beam between posts */}
                  {p < postCount && p % 2 === 0 && (
                    <>
                      <RailBeam
                        start={[
                          px,
                          pz,
                        ]}
                        end={[
                          seg.start[0] + seg.dirX * seg.length * ((p + 2) / Math.max(postCount, 1)) + seg.perpX * (TRACK_WIDTH / 2 + 1),
                          seg.start[1] + seg.dirZ * seg.length * ((p + 2) / Math.max(postCount, 1)) + seg.perpZ * (TRACK_WIDTH / 2 + 1),
                        ]}
                        color={railColor}
                        opacity={railOpacity}
                      />
                      <RailBeam
                        start={[
                          nx,
                          nz,
                        ]}
                        end={[
                          seg.start[0] + seg.dirX * seg.length * ((p + 2) / Math.max(postCount, 1)) - seg.perpX * (TRACK_WIDTH / 2 + 1),
                          seg.start[1] + seg.dirZ * seg.length * ((p + 2) / Math.max(postCount, 1)) - seg.perpZ * (TRACK_WIDTH / 2 + 1),
                        ]}
                        color={railColor}
                        opacity={railOpacity}
                      />
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function RailBeam({
  start,
  end,
  color,
  opacity,
}: {
  start: [number, number];
  end: [number, number];
  color: string;
  opacity: number;
}) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.1) return null;
  const cx = (start[0] + end[0]) / 2;
  const cz = (start[1] + end[1]) / 2;
  const angle = Math.atan2(dx, dz);

  return (
    <mesh
      position={[cx, 0.7, cz]}
      rotation-y={angle}
    >
      <boxGeometry args={[0.08, 0.06, len]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        opacity={opacity}
        transparent
        roughness={0.4}
      />
    </mesh>
  );
}

/* ================================================================== */
/*  Track lights (neon poles along the road)                            */
/* ================================================================== */

function TrackLights({ roadSegments }: { roadSegments: RoadSegmentData[] }) {
  const poles: { x: number; z: number }[] = [];

  roadSegments.forEach((seg) => {
    const count = Math.floor(seg.length / 25);
    for (let p = 1; p <= count; p++) {
      const t = p / (count + 1);
      // Left side poles
      poles.push({
        x: seg.start[0] + seg.dirX * seg.length * t + seg.perpX * (TRACK_WIDTH / 2 + 4),
        z: seg.start[1] + seg.dirZ * seg.length * t + seg.perpZ * (TRACK_WIDTH / 2 + 4),
      });
      // Right side poles
      poles.push({
        x: seg.start[0] + seg.dirX * seg.length * t - seg.perpX * (TRACK_WIDTH / 2 + 4),
        z: seg.start[1] + seg.dirZ * seg.length * t - seg.perpZ * (TRACK_WIDTH / 2 + 4),
      });
    }
  });

  return (
    <group>
      {poles.map(({ x, z }, i) => (
        <group key={`pole-${i}`} position={[x, 2.5, z]}>
          {/* Pole */}
          <mesh>
            <cylinderGeometry args={[0.25, 0.25, 5, 8]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Light fixture */}
          <mesh position={[0, 2.6, 0]}>
            <boxGeometry args={[0.6, 0.3, 0.3]} />
            <meshStandardMaterial color="#1e1e2e" roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Glow sphere */}
          <mesh position={[0, 2.1, 0]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? "#d946ef" : i % 3 === 1 ? "#60a5fa" : "#bef264"}
              emissive={i % 3 === 0 ? "#d946ef" : i % 3 === 1 ? "#60a5fa" : "#bef264"}
              emissiveIntensity={1.5}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Trees (instanced across the landscape)                              */
/* ================================================================== */

function Trees() {
  // Deterministic pseudo-random based on seed + index
  const trees = useMemo(() => {
    const result: { x: number; z: number; s: number }[] = [];
    const avoidRadius = 50;
    let s = 42;

    for (let i = 0; i < 200; i++) {
      s = (s * 16807) % 2147483647;
      const x = ((s - 1) / 2147483646 - 0.5) * 900;
      s = (s * 16807) % 2147483647;
      const z = ((s - 1) / 2147483646 - 0.5) * 900;
      let tooClose = false;
      for (const [tx, tz] of TRACK_PATH) {
        const dx = x - tx;
        const dz = z - tz;
        if (Math.sqrt(dx * dx + dz * dz) < avoidRadius) { tooClose = true; break; }
      }
      if (!tooClose) {
        s = (s * 16807) % 2147483647;
        result.push({ x, z, s: 0.6 + ((s - 1) / 2147483646) * 2.5 });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {trees.map(({ x, z, s }, i) => (
        <group key={`tree-${i}`} position={[x, 0, z]}>
          {/* Trunk */}
          <mesh position={[0, s * 1.5, 0]}>
            <cylinderGeometry args={[0.15 * s, 0.25 * s, s * 3, 6]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {/* Canopy — layered cones */}
          {[0, 1, 2].map((layer) => (
            <mesh key={layer} position={[0, s * (2.5 + layer * 1.2), 0]}>
              <coneGeometry args={[s * (1.8 - layer * 0.5), s * 2, 6]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? "#0a2a0a" : i % 3 === 1 ? "#0d1f0d" : "#061a06"}
                roughness={0.8}
                emissive={i % 5 === 0 ? "#0a3a0a" : "#000000"}
                emissiveIntensity={0.15}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Rocks (scattered off-track)                                         */
/* ================================================================== */

function Rocks() {
  const rocks = useMemo(() => {
    const result: { x: number; z: number; s: number; r: [number, number, number] }[] = [];
    const avoidRadius = 35;
    let s = 137;

    for (let i = 0; i < 80; i++) {
      s = (s * 16807) % 2147483647;
      const x = ((s - 1) / 2147483646 - 0.5) * 800;
      s = (s * 16807) % 2147483647;
      const z = ((s - 1) / 2147483646 - 0.5) * 800;
      let tooClose = false;
      for (const [tx, tz] of TRACK_PATH) {
        const dx = x - tx;
        const dz = z - tz;
        if (Math.sqrt(dx * dx + dz * dz) < avoidRadius) { tooClose = true; break; }
      }
      if (!tooClose) {
        s = (s * 16807) % 2147483647;
        const size = 0.4 + ((s - 1) / 2147483646) * 2;
        s = (s * 16807) % 2147483647;
        const rx = ((s - 1) / 2147483646) * 0.5;
        s = (s * 16807) % 2147483647;
        const ry = ((s - 1) / 2147483646) * Math.PI;
        s = (s * 16807) % 2147483647;
        const rz = ((s - 1) / 2147483646) * 0.5;
        result.push({ x, z, s: size, r: [rx, ry, rz] });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {rocks.map(({ x, z, s, r }, i) => (
        <mesh key={`rock-${i}`} position={[x, s * 0.3, z]} rotation={r}>
          <icosahedronGeometry args={[s, 1]} />
          <meshStandardMaterial color="#1a1a20" roughness={0.7} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Billboards / banners (track-side signs)                             */
/* ================================================================== */

function Billboards() {
  // Place a few signs at key points
  const signs: { x: number; z: number; rot: number; text: string }[] = [
    { x: 0, z: -85, rot: 0, text: "START" },
    { x: 0, z: 190, rot: 0, text: "SPEED" },
    { x: 220, z: 310, rot: Math.PI / 4, text: "DRIFT" },
    { x: 380, z: 10, rot: 0, text: "NITRO" },
    { x: 140, z: -250, rot: 0, text: "RACE" },
  ];

  return (
    <group>
      {signs.map(({ x, z, rot, text }, i) => (
        <group key={`sign-${i}`} position={[x, 0, z]} rotation-y={rot}>
          {/* Post */}
          <mesh position={[0, 2, TRACK_WIDTH / 2 + 6]}>
            <cylinderGeometry args={[0.2, 0.2, 4, 8]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* Board */}
          <mesh position={[0, 4.5, TRACK_WIDTH / 2 + 6]}>
            <boxGeometry args={[text.length * 1.2, 1.5, 0.2]} />
            <meshStandardMaterial color="#111118" roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Text glow bar */}
          <mesh position={[0, 4.5, TRACK_WIDTH / 2 + 6.15]}>
            <boxGeometry args={[text.length * 1.0, 0.4, 0.05]} />
            <meshBasicMaterial color="#d946ef" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  World bounds (prevent driving off map)                              */
/* ================================================================== */

function WorldBounds() {
  const wallH = 3;
  const wallColor = "#d946ef";
  const wallOpacity = 0.15;
  const halfX = WORLD_HALF - 10;
  const halfZ = WORLD_HALF - 10;

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
