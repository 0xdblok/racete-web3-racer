"use client";

import React, { useMemo } from "react";
import {
  getGuardrailDebugLines,
  getWorldBoundDebugLines,
} from "./track-collisions";

/* ================================================================== */
/*  RaceMap — Neon city street-racing circuit                          */
/*  ~1000×1000 playable area, closed-loop track through urban blocks   */
/* ================================================================== */

/** Set true to show collision wireframes (dev only) */
const SHOW_COLLISION_DEBUG = false;

/* ── Track path (waypoints defining the circuit) ── */
// Clockwise: start at z=-80, go north → east → south → west → return
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

const TRACK_WIDTH = 14;    // road width in meters
const WORLD_HALF = 500;    // world boundary radius
const SIDEWALK_WIDTH = 3;  // sidewalk on each side of the road
const CURB_HEIGHT = 0.15;

/* ================================================================== */
/*  Types + road builder                                                */
/* ================================================================== */

type RoadSegmentData = {
  start: [number, number];
  end: [number, number];
  length: number;
  angle: number;
  dirX: number;
  dirZ: number;
  perpX: number;
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

function distanceToTrackCenter(x: number, z: number, segments: RoadSegmentData[]): number {
  let best = Infinity;
  for (const seg of segments) {
    const ax = seg.start[0];
    const az = seg.start[1];
    const bx = seg.end[0];
    const bz = seg.end[1];
    const abx = bx - ax;
    const abz = bz - az;
    const lenSq = abx * abx + abz * abz;
    if (lenSq < 0.001) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / lenSq));
    const px = ax + abx * t;
    const pz = az + abz * t;
    const dx = x - px;
    const dz = z - pz;
    best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
  }
  return best;
}

/* ── LCG deterministic random ── */
function lcg(seed: number): number {
  return ((seed * 16807) % 2147483647);
}

/* ================================================================== */
/*  Main component                                                      */
/* ================================================================== */

export function RaceMap() {
  const roadSegments = useMemo(() => buildRoadSegments(TRACK_PATH), []);

  return (
    <group>
      {/* Ground + city floor */}
      <Ground />

      {/* Road surface */}
      {roadSegments.map((seg, i) => (
        <RoadSegment key={`road-${i}`} seg={seg} />
      ))}

      {/* Road markings */}
      {roadSegments.map((seg, i) => (
        <RoadMarkings key={`mark-${i}`} seg={seg} />
      ))}

      {/* Sidewalks */}
      {roadSegments.map((seg, i) => (
        <Sidewalk key={`sw-${i}`} seg={seg} />
      ))}

      {/* Start / finish line */}
      <StartFinishLine />

      {/* Sleek barriers aligned to collision boundary */}
      <ConcreteBarriers roadSegments={roadSegments} />

      {/* Modern street lights — safely outside the driving corridor */}
      <CityLights roadSegments={roadSegments} />

      {/* Buildings kept far outside road + sidewalk + camera corridor */}
      <Buildings />

      {/* Neon signs & billboards — outside barriers only */}
      <NeonSigns roadSegments={roadSegments} />

      {/* Distant skyline */}
      <Skyline />

      {/* World boundary walls */}
      <WorldBounds />

      {/* Collision debug wireframes */}
      {SHOW_COLLISION_DEBUG && <CollisionDebug />}
    </group>
  );
}

/* ================================================================== */
/*  Ground — dark city concrete                                        */
/* ================================================================== */

function Ground() {
  return (
    <group>
      {/* Main city ground */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.02, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color="#111118" roughness={0.85} metalness={0.05} />
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
  const cx = (seg.start[0] + seg.end[0]) / 2;
  const cz = (seg.start[1] + seg.end[1]) / 2;

  return (
    <mesh rotation={[-Math.PI / 2, 0, seg.angle]} position={[cx, 0.01, cz]} receiveShadow>
      <planeGeometry args={[TRACK_WIDTH, seg.length]} />
      <meshStandardMaterial color="#202434" roughness={0.42} metalness={0.28} />
    </mesh>
  );
}

function RoadMarkings({ seg }: { seg: RoadSegmentData }) {
  const cx = (seg.start[0] + seg.end[0]) / 2;
  const cz = (seg.start[1] + seg.end[1]) / 2;
  const isStraight = seg.length > 50;

  return (
    <group rotation={[-Math.PI / 2, 0, seg.angle]} position={[cx, 0.025, cz]}>
      {/* Bright solid edge lines */}
      <mesh position={[-TRACK_WIDTH / 2 + 0.35, 0, 0]}>
        <planeGeometry args={[0.32, seg.length]} />
        <meshBasicMaterial color="#f8fafc" opacity={0.9} transparent />
      </mesh>
      <mesh position={[TRACK_WIDTH / 2 - 0.35, 0, 0]}>
        <planeGeometry args={[0.32, seg.length]} />
        <meshBasicMaterial color="#f8fafc" opacity={0.9} transparent />
      </mesh>

      {/* Cyan neon curb-guide strips just inside the edges */}
      <mesh position={[-TRACK_WIDTH / 2 + 0.9, 0.002, 0]}>
        <planeGeometry args={[0.12, seg.length]} />
        <meshBasicMaterial color="#22d3ee" opacity={0.45} transparent />
      </mesh>
      <mesh position={[TRACK_WIDTH / 2 - 0.9, 0.002, 0]}>
        <planeGeometry args={[0.12, seg.length]} />
        <meshBasicMaterial color="#d946ef" opacity={0.42} transparent />
      </mesh>

      {/* Center dashed line (straights only) */}
      {isStraight && <CenterDash length={seg.length} />}

      {/* Direction arrows on long straights */}
      {isStraight && <ArrowRepeater length={seg.length} />}
    </group>
  );
}

function CenterDash({ length }: { length: number }) {
  const count = Math.floor(length / 5);
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[0, 0, -length / 2 + i * 5 + 2.5]} visible={i % 2 === 0}>
          <planeGeometry args={[0.22, 3]} />
          <meshBasicMaterial color="#f8fafc" opacity={0.72} transparent />
        </mesh>
      ))}
    </group>
  );
}

function ArrowRepeater({ length }: { length: number }) {
  const count = Math.max(1, Math.floor(length / 70));
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <group key={`arrow-${i}`} position={[0, 0.003, -length / 2 + ((i + 1) * length) / (count + 1)]}>
          <DirectionArrow />
        </group>
      ))}
    </group>
  );
}

function DirectionArrow() {
  // Flat road paint only — not a physical obstacle.
  return (
    <group position={[0, 0.005, 0]}>
      <mesh position={[0, 0, -0.75]}>
        <boxGeometry args={[0.55, 0.01, 2.3]} />
        <meshBasicMaterial color="#bef264" opacity={0.82} transparent />
      </mesh>
      <mesh position={[0, 0, 0.7]} rotation-z={Math.PI / 2}>
        <coneGeometry args={[0.9, 1.4, 3, 1]} />
        <meshBasicMaterial color="#bef264" opacity={0.82} transparent />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  Sidewalks                                                            */
/* ================================================================== */

function Sidewalk({ seg }: { seg: RoadSegmentData }) {
  const cx = (seg.start[0] + seg.end[0]) / 2;
  const cz = (seg.start[1] + seg.end[1]) / 2;
  const offset = TRACK_WIDTH / 2 + SIDEWALK_WIDTH / 2;

  return (
    <group rotation={[-Math.PI / 2, 0, seg.angle]} position={[cx, CURB_HEIGHT, cz]}>
      {/* Left sidewalk */}
      <mesh position={[-offset, 0, 0]} receiveShadow>
        <planeGeometry args={[SIDEWALK_WIDTH, seg.length]} />
        <meshStandardMaterial color="#111827" roughness={0.62} metalness={0.12} />
      </mesh>
      {/* Right sidewalk */}
      <mesh position={[offset, 0, 0]} receiveShadow>
        <planeGeometry args={[SIDEWALK_WIDTH, seg.length]} />
        <meshStandardMaterial color="#111827" roughness={0.62} metalness={0.12} />
      </mesh>

      {/* Curbs (slightly raised edge between road and sidewalk) */}
      <mesh position={[-TRACK_WIDTH / 2 - 0.15, CURB_HEIGHT / 2 + 0.01, 0]}>
        <boxGeometry args={[0.3, CURB_HEIGHT, seg.length]} />
        <meshStandardMaterial color="#334155" roughness={0.44} metalness={0.24} />
      </mesh>
      <mesh position={[TRACK_WIDTH / 2 + 0.15, CURB_HEIGHT / 2 + 0.01, 0]}>
        <boxGeometry args={[0.3, CURB_HEIGHT, seg.length]} />
        <meshStandardMaterial color="#334155" roughness={0.44} metalness={0.24} />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  Start / Finish line — checkered + neon                             */
/* ================================================================== */

function StartFinishLine() {
  const z = -80;
  return (
    <group>
      {/* Checkered line */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[-6.5 + i, 0.045, z]}>
          <planeGeometry args={[0.9, 2.0]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#ffffff" : "#111111"} />
        </mesh>
      ))}

      {/* Neon start arch */}
      <StartArch z={z - 4} />

      {/* Grid position markers */}
      {[-4, -2, 0, 2, 4].map((x) => (
        <mesh key={`sp-${x}`} position={[x, 0.075, z + 5]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.25, 0.5, 16]} />
          <meshBasicMaterial color="#bef264" />
        </mesh>
      ))}
    </group>
  );
}

function StartArch({ z }: { z: number }) {
  const archH = 8;
  const archW = TRACK_WIDTH + 4;
  return (
    <group position={[0, 0, z]}>
      {/* Left pillar */}
      <mesh position={[-archW / 2 + 0.5, archH / 2, 0]}>
        <boxGeometry args={[0.5, archH, 0.5]} />
        <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Right pillar */}
      <mesh position={[archW / 2 - 0.5, archH / 2, 0]}>
        <boxGeometry args={[0.5, archH, 0.5]} />
        <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Top beam */}
      <mesh position={[0, archH, 0]}>
        <boxGeometry args={[archW, 0.4, 0.5]} />
        <meshStandardMaterial color="#18181b" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Neon strip on top beam */}
      <mesh position={[0, archH + 0.2, 0.3]}>
        <boxGeometry args={[archW - 1, 0.08, 0.08]} />
        <meshBasicMaterial color="#d946ef" />
      </mesh>
      {/* Glow spheres on pillars */}
      <mesh position={[-archW / 2 + 0.5, archH + 0.5, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#d946ef" emissive="#d946ef" emissiveIntensity={2} roughness={0.2} />
      </mesh>
      <mesh position={[archW / 2 - 0.5, archH + 0.5, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color="#d946ef" emissive="#d946ef" emissiveIntensity={2} roughness={0.2} />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  Concrete barriers (at collision boundary — TRACK_WIDTH/2+1)        */
/* ================================================================== */

function ConcreteBarriers({ roadSegments }: { roadSegments: RoadSegmentData[] }) {
  return (
    <group>
      {roadSegments.map((seg, i) => {
        const cx = (seg.start[0] + seg.end[0]) / 2;
        const cz = (seg.start[1] + seg.end[1]) / 2;
        const offset = TRACK_WIDTH / 2 + 1;
        return (
          <React.Fragment key={`barrier-${i}`}>
            <BarrierRail
              x={cx + seg.perpX * offset}
              z={cz + seg.perpZ * offset}
              angle={seg.angle}
              length={seg.length}
            />
            <BarrierRail
              x={cx - seg.perpX * offset}
              z={cz - seg.perpZ * offset}
              angle={seg.angle}
              length={seg.length}
            />
          </React.Fragment>
        );
      })}
    </group>
  );
}

function BarrierRail({ x, z, angle, length }: { x: number; z: number; angle: number; length: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={angle}>
      {/* Low concrete wall aligned with collision boundary */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.45, 0.7, length]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.44} metalness={0.18} />
      </mesh>
      {/* Clean neon guide strip */}
      <mesh position={[0, 0.76, 0]}>
        <boxGeometry args={[0.12, 0.08, length]} />
        <meshBasicMaterial color="#22d3ee" opacity={0.78} transparent />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.5, 0.08, length]} />
        <meshBasicMaterial color="#d946ef" opacity={0.45} transparent />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  City street lights — tall poles with neon glow                     */
/* ================================================================== */

function CityLights({ roadSegments }: { roadSegments: RoadSegmentData[] }) {
  const poles = useMemo(() => {
    const result: { x: number; z: number; colorI: number }[] = [];
    roadSegments.forEach((seg) => {
      const count = Math.floor(seg.length / 30);
      for (let p = 1; p <= count; p++) {
        const t = p / (count + 1);
        result.push({
          x: seg.start[0] + seg.dirX * seg.length * t + seg.perpX * (TRACK_WIDTH / 2 + 9),
          z: seg.start[1] + seg.dirZ * seg.length * t + seg.perpZ * (TRACK_WIDTH / 2 + 9),
          colorI: result.length,
        });
        result.push({
          x: seg.start[0] + seg.dirX * seg.length * t - seg.perpX * (TRACK_WIDTH / 2 + 9),
          z: seg.start[1] + seg.dirZ * seg.length * t - seg.perpZ * (TRACK_WIDTH / 2 + 9),
          colorI: result.length,
        });
      }
    });
    return result;
  }, [roadSegments]);

  return (
    <group>
      {poles.map(({ x, z, colorI }, i) => (
        <group key={`cl-${i}`} position={[x, 0, z]}>
          {/* Tall pole */}
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.2, 0.3, 8, 8]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Arm extending over road */}
          <mesh position={[0, 7.5, 0]}>
            <boxGeometry args={[0.15, 0.15, 3]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Light housing */}
          <mesh position={[0, 7.0, 1.8]}>
            <boxGeometry args={[0.6, 0.35, 0.8]} />
            <meshStandardMaterial color="#1e1e2e" roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Glow orb */}
          <mesh position={[0, 6.75, 1.8]}>
            <sphereGeometry args={[0.45, 8, 8]} />
            <meshStandardMaterial
              color={colorI % 3 === 0 ? "#d946ef" : colorI % 3 === 1 ? "#60a5fa" : "#bef264"}
              emissive={colorI % 3 === 0 ? "#d946ef" : colorI % 3 === 1 ? "#60a5fa" : "#bef264"}
              emissiveIntensity={1.8}
              roughness={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Buildings — city blocks along the circuit                          */
/* ================================================================== */

type BuildingData = {
  x: number; z: number;
  w: number; d: number; h: number;
  color: string;
  windowRows: number; windowCols: number;
};

function Buildings() {
  const buildings = useMemo(() => generateBuildings(), []);

  return (
    <group>
      {buildings.map((b, i) => (
        <Building key={`bld-${i}`} data={b} />
      ))}
    </group>
  );
}

const BUILDING_COLORS = [
  "#0f172a", "#111827", "#172033", "#0b1120", "#1e293b",
  "#101827", "#162033", "#0f1b2d", "#182235", "#111a2c",
];

function generateBuildings(): BuildingData[] {
  const result: BuildingData[] = [];
  const trackSegments = buildRoadSegments(TRACK_PATH);
  const safeClearance = TRACK_WIDTH / 2 + SIDEWALK_WIDTH + 18; // road + barrier + sidewalk + camera gap
  let s = 42069; // LCG seed

  for (let i = 0; i < 140 && result.length < 82; i++) {
    s = lcg(s);
    const x = ((s - 1) / 2147483646 - 0.5) * 850;
    s = lcg(s);
    const z = ((s - 1) / 2147483646 - 0.5) * 850;

    s = lcg(s);
    const w = 8 + ((s - 1) / 2147483646) * 20; // clean modern blocks, 8-28m
    s = lcg(s);
    const d = 8 + ((s - 1) / 2147483646) * 18; // 8-26m
    const footprintRadius = Math.sqrt(w * w + d * d) / 2;

    // Keep building footprint safely outside the entire track corridor, not just waypoints.
    const centerDistance = distanceToTrackCenter(x, z, trackSegments);
    if (centerDistance - footprintRadius < safeClearance) continue;

    s = lcg(s);
    const hRand = (s - 1) / 2147483646;
    const h = hRand < 0.18 ? 10 + hRand * 18 : 24 + hRand * 40;

    s = lcg(s);
    const windowRows = Math.floor(4 + ((s - 1) / 2147483646) * (h / 3.5));
    s = lcg(s);
    const windowColsW = Math.floor(2 + ((s - 1) / 2147483646) * (w / 4));
    const windowColsD = Math.floor(2 + ((s - 1) / 2147483646) * (d / 4));
    const color = BUILDING_COLORS[result.length % BUILDING_COLORS.length];

    result.push({ x, z, w, d, h, color, windowRows, windowCols: Math.max(windowColsW, windowColsD) });
  }
  return result;
}

function Building({ data }: { data: BuildingData }) {
  const { x, z, w, d, h, color, windowRows, windowCols } = data;
  const halfH = h / 2;

  return (
    <group position={[x, halfH, z]}>
      {/* Main block */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Windows — emissive strips on the two long facades */}
      <Windows
        facade="width"
        w={w} d={d} h={h}
        rows={windowRows}
        cols={Math.min(windowCols, Math.floor(w / 2.5))}
      />
      <Windows
        facade="depth"
        w={w} d={d} h={h}
        rows={windowRows}
        cols={Math.min(windowCols, Math.floor(d / 2.5))}
      />

      {/* Roof accent */}
      <mesh position={[0, halfH + 0.1, 0]}>
        <boxGeometry args={[w + 0.3, 0.2, d + 0.3]} />
        <meshStandardMaterial color="#0d0d15" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Roof neon edge glow */}
      <mesh position={[0, halfH + 0.25, d / 2 + 0.1]}>
        <boxGeometry args={[w, 0.06, 0.06]} />
        <meshBasicMaterial color="#d946ef" opacity={0.5} transparent />
      </mesh>
    </group>
  );
}

function Windows({
  facade, w, d, h, rows, cols,
}: {
  facade: "width" | "depth";
  w: number; d: number; h: number;
  rows: number; cols: number;
}) {
  const facadeLen = facade === "width" ? w : d;
  const offsetZ = facade === "width" ? d / 2 + 0.05 : 0;
  const offsetX = facade === "width" ? 0 : w / 2 + 0.05;
  const stepV = h / (rows + 1);
  const stepH = facadeLen / (cols + 1);

  const windows = useMemo(() => {
    const r: { x: number; y: number }[] = [];
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        r.push({
          x: -facadeLen / 2 + col * stepH,
          y: -h / 2 + row * stepV,
        });
      }
    }
    return r;
  }, [rows, cols, stepH, stepV, facadeLen, h]);

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={facade === "depth" ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      {windows.map(({ x, y }, i) => (
        <mesh key={`win-${i}`} position={[x, y, 0]}>
          <planeGeometry args={[stepH * 0.55, stepV * 0.4]} />
          <meshBasicMaterial
            color={i % 7 === 0 ? "#d946ef" : i % 5 === 0 ? "#60a5fa" : "#fbbf24"}
            opacity={0.35 + (i % 3) * 0.15}
            transparent
            side={2}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Neon signs & billboards                                             */
/* ================================================================== */

function NeonSigns({ roadSegments }: { roadSegments: RoadSegmentData[] }) {
  const signs = useMemo(() => {
    const result: { x: number; z: number; rot: number; w: number; h: number; color: string }[] = [];
    roadSegments.forEach((seg, si) => {
      if (si % 5 !== 0) return; // fewer signs, less clutter
      const t = 0.5;
      const signOffset = TRACK_WIDTH / 2 + 16;
      // Left of road
      result.push({
        x: seg.start[0] + seg.dirX * seg.length * t + seg.perpX * signOffset,
        z: seg.start[1] + seg.dirZ * seg.length * t + seg.perpZ * signOffset,
        rot: seg.angle + Math.PI / 2,
        w: 5,
        h: 2,
        color: ["#d946ef", "#60a5fa", "#bef264", "#f97316", "#ef4444"][si % 5],
      });
      // Right of road
      result.push({
        x: seg.start[0] + seg.dirX * seg.length * t - seg.perpX * signOffset,
        z: seg.start[1] + seg.dirZ * seg.length * t - seg.perpZ * signOffset,
        rot: seg.angle + Math.PI / 2,
        w: 5,
        h: 2,
        color: ["#60a5fa", "#bef264", "#d946ef", "#ef4444", "#f97316"][si % 5],
      });
    });
    return result;
  }, [roadSegments]);

  return (
    <group>
      {signs.map((s, i) => (
        <group key={`sign-${i}`} position={[s.x, 4.5, s.z]} rotation-y={s.rot}>
          {/* Sign pole */}
          <mesh position={[0, -2.5, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 5, 8]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* Sign board */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[s.w, s.h, 0.2]} />
            <meshStandardMaterial color="#111118" roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Neon frame */}
          <mesh position={[0, 0, 0.15]}>
            <boxGeometry args={[s.w - 0.4, s.h - 0.3, 0.04]} />
            <meshBasicMaterial color={s.color} />
          </mesh>
          {/* Neon border strip */}
          <mesh position={[0, s.h / 2 - 0.2, 0.12]}>
            <boxGeometry args={[s.w - 0.4, 0.08, 0.04]} />
            <meshBasicMaterial color={s.color} />
          </mesh>
          <mesh position={[0, -s.h / 2 + 0.2, 0.12]}>
            <boxGeometry args={[s.w - 0.4, 0.08, 0.04]} />
            <meshBasicMaterial color={s.color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Skyline — distant buildings on the world edge                      */
/* ================================================================== */

function Skyline() {
  const buildings = useMemo(() => {
    const result: { x: number; z: number; w: number; h: number }[] = [];
    let s = 77777;
    const edge = WORLD_HALF - 20;

    for (let i = 0; i < 60; i++) {
      s = lcg(s);
      const side = s % 4; // 0=top, 1=right, 2=bottom, 3=left
      s = lcg(s);
      const along = ((s - 1) / 2147483646 - 0.5) * 900;

      let x: number, z: number;
      if (side === 0) { x = along; z = -edge; }
      else if (side === 1) { x = edge; z = along; }
      else if (side === 2) { x = along; z = edge; }
      else { x = -edge; z = along; }

      s = lcg(s);
      const w = 8 + ((s - 1) / 2147483646) * 30;
      s = lcg(s);
      const h = 20 + ((s - 1) / 2147483646) * 80;

      result.push({ x, z, w, h });
    }
    return result;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={`sky-${i}`} position={[b.x, b.h / 2, b.z]} castShadow>
          <boxGeometry args={[b.w, b.h, 8]} />
          <meshStandardMaterial color="#0a0a14" roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  World bounds                                                        */
/* ================================================================== */

function WorldBounds() {
  const wallH = 4;
  const half = WORLD_HALF - 10;

  const walls: Array<{
    pos: [number, number, number];
    size: [number, number, number];
  }> = [
    { pos: [0, wallH / 2, -half], size: [half * 2, wallH, 0.5] },
    { pos: [0, wallH / 2, half], size: [half * 2, wallH, 0.5] },
    { pos: [-half, wallH / 2, 0], size: [0.5, wallH, half * 2] },
    { pos: [half, wallH / 2, 0], size: [0.5, wallH, half * 2] },
  ];

  return (
    <group>
      {walls.map((w, i) => (
        <mesh key={`wb-${i}`} position={w.pos}>
          <boxGeometry args={w.size} />
          <meshStandardMaterial
            color="#d946ef" emissive="#d946ef" emissiveIntensity={0.2}
            opacity={0.12} transparent roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ================================================================== */
/*  Collision debug wireframes                                          */
/* ================================================================== */

function CollisionDebug() {
  const guardrailLines = useMemo(() => getGuardrailDebugLines(), []);
  const worldLines = useMemo(() => getWorldBoundDebugLines(), []);

  return (
    <group>
      {/* Guardrail collision boundaries */}
      {guardrailLines.map((line, i) => {
        const dx = line.x2 - line.x1;
        const dz = line.z2 - line.z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) return null;
        const cx = (line.x1 + line.x2) / 2;
        const cz = (line.z1 + line.z2) / 2;
        const angle = Math.atan2(dx, dz);
        return (
          <mesh key={`g-debug-${i}`} position={[cx, 0.4, cz]} rotation-y={angle}>
            <boxGeometry args={[0.05, 0.05, len]} />
            <meshBasicMaterial color="#ff4444" opacity={0.8} transparent />
          </mesh>
        );
      })}
      {/* World boundary debug */}
      {worldLines.map((line, i) => {
        const dx = line.x2 - line.x1;
        const dz = line.z2 - line.z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) return null;
        const cx = (line.x1 + line.x2) / 2;
        const cz = (line.z1 + line.z2) / 2;
        const angle = Math.atan2(dx, dz);
        return (
          <mesh key={`w-debug-${i}`} position={[cx, 0.4, cz]} rotation-y={angle}>
            <boxGeometry args={[0.08, 0.08, len]} />
            <meshBasicMaterial color="#ff8800" opacity={0.7} transparent />
          </mesh>
        );
      })}
    </group>
  );
}
