"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  Big Test Track — 300x200 driving area with road, barriers, cones   */
/* ------------------------------------------------------------------ */

export function TestTrack() {
  return (
    <group>
      {/* Ground plane — dark asphalt */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[300, 200]} />
        <meshStandardMaterial color="#1a1a24" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Main road — wide straight + oval section */}
      <RoadSection />

      {/* Track boundary walls */}
      <BoundaryWalls />

      {/* Lane markers */}
      <LaneMarkers />

      {/* Start / finish line */}
      <StartLine />

      {/* Direction arrows on the ground */}
      <DirectionArrows />

      {/* Test cones / barriers for steering practice */}
      <ConeMarkers />

      {/* Lighting reference posts */}
      <ReferencePosts />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Road surface                                                        */
/* ------------------------------------------------------------------ */

function RoadSection() {
  // Main straight going +Z from origin
  return (
    <group>
      {/* Wide main straight */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 40]} receiveShadow>
        <planeGeometry args={[18, 120]} />
        <meshStandardMaterial color="#2a2a38" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Turn area at far end (oval loop) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 90]} receiveShadow>
        <ringGeometry args={[28, 40, 64, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#2a2a38" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Return straight (outer lane going -Z) */}
      <mesh rotation-x={-Math.PI / 2} position={[30, 0.01, 40]} receiveShadow>
        <planeGeometry args={[18, 120]} />
        <meshStandardMaterial color="#2a2a38" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Road edge lines */}
      {[-9, 9].map((x) => (
        <React.Fragment key={`edge-${x}`}>
          {/* Main straight edges */}
          <mesh rotation-x={-Math.PI / 2} position={[x, 0.02, 40]}>
            <planeGeometry args={[0.3, 120]} />
            <meshBasicMaterial color="#ffffff" opacity={0.5} transparent />
          </mesh>
          {/* Return straight edges */}
          <mesh rotation-x={-Math.PI / 2} position={[30 + x, 0.02, 40]}>
            <planeGeometry args={[0.3, 120]} />
            <meshBasicMaterial color="#ffffff" opacity={0.5} transparent />
          </mesh>
        </React.Fragment>
      ))}

      {/* Center dashed line on main straight */}
      <DashedLine position={[0, 0.02, 0]} length={120} />
      {/* Center dashed line on return straight */}
      <DashedLine position={[30, 0.02, 0]} length={120} />
    </group>
  );
}

function DashedLine({ position, length }: { position: [number, number, number]; length: number }) {
  const segments = Math.floor(length / 5);
  return (
    <group position={position}>
      {Array.from({ length: segments }).map((_, i) => (
        <mesh
          key={i}
          rotation-x={-Math.PI / 2}
          position={[(i % 2) * 0.001, 0, i * 5 - length / 2 + 2.5]}
        >
          <planeGeometry args={[0.15, 2.5]} />
          <meshBasicMaterial color="#ffffff" opacity={0.35} transparent />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Boundary walls                                                      */
/* ------------------------------------------------------------------ */

function BoundaryWalls() {
  const wallHeight = 1.5;
  const wallColor = "#d946ef";
  const wallOpacity = 0.15;

  // Arena boundary (150x100 area)
  const halfX = 75;
  const halfZ = 50;

  return (
    <group>
      {/* North wall */}
      <BoxWall
        position={[0, wallHeight / 2, -halfZ]}
        size={[halfX * 2, wallHeight, 0.4]}
        color={wallColor}
        opacity={wallOpacity}
      />
      {/* South wall */}
      <BoxWall
        position={[0, wallHeight / 2, halfZ]}
        size={[halfX * 2, wallHeight, 0.4]}
        color={wallColor}
        opacity={wallOpacity}
      />
      {/* West wall */}
      <BoxWall
        position={[-halfX, wallHeight / 2, 0]}
        size={[0.4, wallHeight, halfZ * 2]}
        color={wallColor}
        opacity={wallOpacity}
      />
      {/* East wall */}
      <BoxWall
        position={[halfX, wallHeight / 2, 0]}
        size={[0.4, wallHeight, halfZ * 2]}
        color={wallColor}
        opacity={wallOpacity}
      />
    </group>
  );
}

function BoxWall({
  position,
  size,
  color,
  opacity,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        opacity={opacity}
        transparent
        roughness={0.5}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Start / finish line                                                 */
/* ------------------------------------------------------------------ */

function StartLine() {
  return (
    <group position={[0, 0.025, -40]}>
      {/* Checkered line */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[i - 4, 0, 0]}>
          <planeGeometry args={[0.9, 0.6]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#ffffff" : "#111111"} />
        </mesh>
      ))}
      {/* START text label */}
      <mesh position={[0, 0.04, 0.4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[6, 1.2]} />
        <meshBasicMaterial color="#bef264" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Direction arrows                                                    */
/* ------------------------------------------------------------------ */

function DirectionArrows() {
  const arrowColor = "#bef264";
  // Arrows along the main straight pointing +Z (forward)
  const arrows = [
    [0, -20], [0, 0], [0, 20], [0, 60],
    [0, 82], [8, 90], [16, 90], [24, 90],
    [30, 80], [30, 60], [30, 20], [30, 0], [30, -20],
  ];

  return (
    <group>
      {arrows.map(([x, z], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[x, 0.03, z]}>
          <planeGeometry args={[1.2, 2.4]} />
          <meshBasicMaterial color={arrowColor} opacity={0.4} transparent />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Lane markers                                                        */
/* ------------------------------------------------------------------ */

function LaneMarkers() {
  return (
    <group>
      {/* Lane divider lines on main straight */}
      {[-6, -3, 3, 6].map((x) => (
        <mesh key={`lane-${x}`} rotation-x={-Math.PI / 2} position={[x, 0.02, 40]}>
          <planeGeometry args={[0.08, 120]} />
          <meshBasicMaterial color="#ffffff" opacity={0.15} transparent />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Test cones                                                          */
/* ------------------------------------------------------------------ */

function ConeMarkers() {
  const coneColor = "#f97316"; // orange
  const cones = [
    // Slalom section (weave pattern on main straight)
    [0, 10], [2.5, 14], [-1.5, 18], [3, 22], [-2, 26],
    [1.5, 30], [-2.5, 34], [2, 38], [-3, 42],
    // Corner apex markers (oval turn)
    [0, 60], [5, 70], [10, 80], [15, 88],
    [22, 92], [30, 88], [38, 80], [42, 70],
    [42, 60],
  ];

  return (
    <group>
      {cones.map(([x, z], i) => (
        <mesh key={`cone-${i}`} position={[x, 0.35, z]} castShadow>
          <coneGeometry args={[0.2, 0.7, 8]} />
          <meshStandardMaterial color={coneColor} emissive={coneColor} emissiveIntensity={0.3} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Reference posts (visual distance markers)                           */
/* ------------------------------------------------------------------ */

function ReferencePosts() {
  const postColor = "#60a5fa"; // blue
  const posts = [
    [-10, -45], [10, -45], [-10, -10], [10, -10],
    [-10, 45], [10, 45], [-10, 85], [10, 85],
    [25, 45], [35, 45], [25, 85], [35, 85],
  ];

  return (
    <group>
      {posts.map(([x, z], i) => (
        <group key={`post-${i}`} position={[x, 1.5, z]}>
          {/* Post */}
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 3, 12]} />
            <meshStandardMaterial color={postColor} emissive={postColor} emissiveIntensity={0.5} roughness={0.3} />
          </mesh>
          {/* Light on top */}
          <mesh position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshStandardMaterial color={postColor} emissive={postColor} emissiveIntensity={1.5} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
