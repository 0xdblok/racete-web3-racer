/* ================================================================== */
/*  Track collision detection & resolution                              */
/*  Matches RaceMap geometry — keeps car on the circuit.                */
/* ================================================================== */

import * as THREE from "three";

/* ── Track geometry (must stay in sync with RaceMap.tsx) ── */

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

const TRACK_WIDTH = 14;           // road width in meters
const GUARDRAIL_OFFSET = 8;       // guardrail distance from centerline (TRACK_WIDTH/2 + 1)
const WORLD_BOUND = 480;          // world edge (hard stop, leaves 10m margin from visual wall at 490)

/* ── Spawn / reset ── */

export const SPAWN_POSITION = new THREE.Vector3(0, 0.3, -80);
export const SPAWN_ROTATION_Y = 0; // facing +Z

/* ── Road segment type ── */

type RoadSegment = {
  start: [number, number];
  end: [number, number];
  length: number;
  dirX: number;    // unit direction of segment
  dirZ: number;
  perpX: number;   // unit perpendicular (right side of forward dir)
  perpZ: number;
};

/* ── Build segments once (lazy) ── */

let _segments: RoadSegment[] | null = null;

function getSegments(): RoadSegment[] {
  if (_segments) return _segments;
  _segments = [];
  for (let i = 0; i < TRACK_PATH.length - 1; i++) {
    const [x1, z1] = TRACK_PATH[i];
    const [x2, z2] = TRACK_PATH[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) continue;
    _segments.push({
      start: [x1, z1],
      end: [x2, z2],
      length: len,
      dirX: dx / len,
      dirZ: dz / len,
      perpX: -dz / len,  // right-hand perpendicular
      perpZ: dx / len,
    });
  }
  return _segments;
}

/* ── Closest point on line segment ── */

function closestPointOnSegment(
  px: number, pz: number,
  ax: number, az: number,
  bx: number, bz: number,
): { t: number; cx: number; cz: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  if (len2 < 0.0001) return { t: 0, cx: ax, cz: az };
  let t = ((px - ax) * abx + (pz - az) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  return { t, cx: ax + abx * t, cz: az + abz * t };
}

/* ── Find nearest segment + signed lateral distance ── */

function nearestSegmentInfo(
  px: number, pz: number,
): { seg: RoadSegment; closestX: number; closestZ: number; lateralDist: number } | null {
  const segs = getSegments();
  let bestSeg: RoadSegment | null = null;
  let bestClosestX = 0;
  let bestClosestZ = 0;
  let bestDist2 = Infinity;

  for (const seg of segs) {
    const { cx, cz } = closestPointOnSegment(
      px, pz,
      seg.start[0], seg.start[1],
      seg.end[0], seg.end[1],
    );
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      bestSeg = seg;
      bestClosestX = cx;
      bestClosestZ = cz;
    }
  }

  if (!bestSeg) return null;

  // Signed lateral: positive = right side, negative = left side
  const dx = px - bestClosestX;
  const dz = pz - bestClosestZ;
  const lateralDist = dx * bestSeg.perpX + dz * bestSeg.perpZ;

  return { seg: bestSeg, closestX: bestClosestX, closestZ: bestClosestZ, lateralDist };
}

/* ================================================================== */
/*  Collision resolution                                                */
/* ================================================================== */

export type CollisionInfo = {
  /** True if car is on the road surface (within track width) */
  onRoad: boolean;
  /** True if car is past guardrail (hard collision resolved) */
  hitGuardrail: boolean;
  /** True if car hit world boundary */
  hitWorldBound: boolean;
  /** 0–1 off-track factor (0 = on road, 1 = fully off-track) */
  offTrackFactor: number;
  /** Speed multiplier from terrain (1.0 = full, 0.0 = stopped) */
  terrainSpeedMult: number;
};

/**
 * Resolve track collisions for a car at `position` moving with `velocity`.
 * Returns adjusted position and velocity, plus collision metadata.
 *
 * @param pos   Car world position (x, z only — y is ignored)
 * @param vel   Car velocity (x, z only — magnitude determines speed check)
 * @returns     { position: [x, z], velocity: [vx, vz], info: CollisionInfo }
 */
export function resolveTrackCollision(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
): {
  position: [number, number];
  velocity: [number, number];
  info: CollisionInfo;
} {
  let px = pos.x;
  let pz = pos.z;
  let vx = vel.x;
  let vz = vel.z;

  const info: CollisionInfo = {
    onRoad: true,
    hitGuardrail: false,
    hitWorldBound: false,
    offTrackFactor: 0,
    terrainSpeedMult: 1.0,
  };

  /* ── 1. Guardrail collision ── */
  const nearest = nearestSegmentInfo(px, pz);
  if (nearest) {
    const { seg, closestX, closestZ, lateralDist } = nearest;
    const absLat = Math.abs(lateralDist);

    // Terrain zones
    if (absLat <= TRACK_WIDTH / 2) {
      // On road — full speed
      info.onRoad = true;
      info.offTrackFactor = 0;
      info.terrainSpeedMult = 1.0;
    } else if (absLat <= GUARDRAIL_OFFSET) {
      // Shoulder — slowed
      info.onRoad = false;
      info.offTrackFactor = (absLat - TRACK_WIDTH / 2) / (GUARDRAIL_OFFSET - TRACK_WIDTH / 2);
      info.terrainSpeedMult = THREE.MathUtils.clamp(1.0 - info.offTrackFactor * 0.6, 0.4, 1.0);
    } else {
      // Past guardrail — hard collision
      info.onRoad = false;
      info.hitGuardrail = true;
      info.offTrackFactor = 1.0;

      // Push car back inside
      const signLat = lateralDist > 0 ? 1 : -1;
      const pushTarget = (GUARDRAIL_OFFSET - 0.3) * signLat; // just inside guardrail
      const pushDelta = pushTarget - lateralDist;
      if (Math.abs(pushDelta) > 0) {
        // Move car to just inside the guardrail
        px = closestX + pushDelta * seg.perpX;
        pz = closestZ + pushDelta * seg.perpZ;
      }

      // Cancel velocity component pushing into the wall
      // Wall normal points inward (toward centerline), opposite to lateral sign
      const wallNx = -signLat * seg.perpX;
      const wallNz = -signLat * seg.perpZ;
      const velIntoWall = vx * wallNx + vz * wallNz;
      if (velIntoWall > 0) {
        // Remove the inward velocity component
        vx -= velIntoWall * wallNx;
        vz -= velIntoWall * wallNz;
      }

      // Allow sliding along wall but at reduced speed
      info.terrainSpeedMult = 0.35;
    }

    // Off-track terrain speed reduction (only if not already handled by guardrail)
    if (!info.hitGuardrail && info.offTrackFactor > 0) {
      // Blend based on how far off-track
      info.terrainSpeedMult = THREE.MathUtils.clamp(1.0 - info.offTrackFactor * 0.7, 0.3, 1.0);
    }
  }

  /* ── 2. World boundary (hard clamps at ±WORLD_BOUND) ── */
  const bound = WORLD_BOUND;
  if (px < -bound) {
    px = -bound;
    if (vx < 0) vx = 0;
    info.hitWorldBound = true;
    info.terrainSpeedMult = Math.min(info.terrainSpeedMult, 0.3);
  }
  if (px > bound) {
    px = bound;
    if (vx > 0) vx = 0;
    info.hitWorldBound = true;
    info.terrainSpeedMult = Math.min(info.terrainSpeedMult, 0.3);
  }
  if (pz < -bound) {
    pz = -bound;
    if (vz < 0) vz = 0;
    info.hitWorldBound = true;
    info.terrainSpeedMult = Math.min(info.terrainSpeedMult, 0.3);
  }
  if (pz > bound) {
    pz = bound;
    if (vz > 0) vz = 0;
    info.hitWorldBound = true;
    info.terrainSpeedMult = Math.min(info.terrainSpeedMult, 0.3);
  }

  return { position: [px, pz], velocity: [vx, vz], info };
}

/* ================================================================== */
/*  Nearest track point (for camera / AI reference)                     */
/* ================================================================== */

export function getNearestTrackPoint(
  px: number,
  pz: number,
): { x: number; z: number; lateralDist: number } {
  const nearest = nearestSegmentInfo(px, pz);
  if (!nearest) return { x: 0, z: -80, lateralDist: 0 };
  return {
    x: nearest.closestX,
    z: nearest.closestZ,
    lateralDist: nearest.lateralDist,
  };
}

/* ================================================================== */
/*  Debug: get collision wireframe data                                 */
/* ================================================================== */

/** Returns guardrail wall lines for debug visualization */
export function getGuardrailDebugLines(): Array<{
  x1: number; z1: number; x2: number; z2: number;
}> {
  const segs = getSegments();
  const lines: Array<{ x1: number; z1: number; x2: number; z2: number }> = [];

  for (const seg of segs) {
    // Left guardrail
    lines.push({
      x1: seg.start[0] - seg.perpX * GUARDRAIL_OFFSET,
      z1: seg.start[1] - seg.perpZ * GUARDRAIL_OFFSET,
      x2: seg.end[0] - seg.perpX * GUARDRAIL_OFFSET,
      z2: seg.end[1] - seg.perpZ * GUARDRAIL_OFFSET,
    });
    // Right guardrail
    lines.push({
      x1: seg.start[0] + seg.perpX * GUARDRAIL_OFFSET,
      z1: seg.start[1] + seg.perpZ * GUARDRAIL_OFFSET,
      x2: seg.end[0] + seg.perpX * GUARDRAIL_OFFSET,
      z2: seg.end[1] + seg.perpZ * GUARDRAIL_OFFSET,
    });
  }

  return lines;
}

/** Returns world boundary wireframe rectangle */
export function getWorldBoundDebugLines(): Array<{
  x1: number; z1: number; x2: number; z2: number;
}> {
  const b = WORLD_BOUND;
  return [
    { x1: -b, z1: -b, x2: b, z2: -b },
    { x1: b, z1: -b, x2: b, z2: b },
    { x1: b, z1: b, x2: -b, z2: b },
    { x1: -b, z1: b, x2: -b, z2: -b },
  ];
}
