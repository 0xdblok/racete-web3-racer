"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";
import {
  useInViewport,
  tryAcquireCanvasSlot,
  releaseCanvasSlot,
  waitForCanvasSlot,
} from "@/lib/useInViewport";

/* ------------------------------------------------------------------ */
/*  Auto-normalization                                                 */
/* ------------------------------------------------------------------ */

const TARGET_SIZE = 3.0;

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
const CAR_OVERRIDES: Record<string, { rotationY?: number; scaleMultiplier?: number }> = {};

// Scale overrides: match GarageShowroom3D for consistent preview sizing
CAR_OVERRIDES["bavaro-sport"] = { scaleMultiplier: 1.8 };
CAR_OVERRIDES["zephyr-z8"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["bavaro-m5"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["valor-gt"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["toro-se"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["volt-c5"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["bavaro-cs"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["warp-x1"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["nova-spider"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["volt-w6"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["furia-gt"] = { scaleMultiplier: 1.3 };
CAR_OVERRIDES["nova-s1"] = { scaleMultiplier: 1.2 };
CAR_OVERRIDES["toro-x"] = { scaleMultiplier: 1.2 };

/* ------------------------------------------------------------------ */
/*  Status type                                                        */
/* ------------------------------------------------------------------ */

type PreviewStatus =
  | "2d-silhouette"
  | "waiting-slot"
  | "acquiring"
  | "loading"
  | "loaded"
  | "failed";

/* ------------------------------------------------------------------ */
/*  StaticCarPreview (public export)                                   */
/* ------------------------------------------------------------------ */

type StaticCarPreviewProps = {
  car: CarConfig;
  ownedCar?: PlayerCar;
  /** Optional accent color override (falls back to class-based) */
  accentOverride?: string;
};

export function StaticCarPreview({ car, ownedCar, accentOverride }: StaticCarPreviewProps) {
  const { ref, inView } = useInViewport();
  const accent = accentOverride || getAccent(car.class);
  const [status, setStatus] = useState<PreviewStatus>("2d-silhouette");
  const [retryCount, setRetryCount] = useState(0);

  // No model → always 2D
  if (!car.modelUrl) {
    return (
      <div ref={ref} className={containerClass}>
        <Silhouette2D car={car} accent={accent} />
        <StatusLabel text="Model not uploaded yet" tone="amber" />
      </div>
    );
  }

  // Not in viewport → 2D
  if (!inView) {
    return (
      <div ref={ref} className={containerClass}>
        <Silhouette2D car={car} accent={accent} />
      </div>
    );
  }

  // In viewport — try to acquire slot
  return (
    <div ref={ref} className={containerClass}>
      <InViewPreview
        car={car}
        accent={accent}
        status={status}
        setStatus={setStatus}
        retryCount={retryCount}
        setRetryCount={setRetryCount}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  InViewPreview — manages slot acquisition, loading, retry           */
/* ------------------------------------------------------------------ */

function InViewPreview({
  car,
  accent,
  status,
  setStatus,
  retryCount,
  setRetryCount,
}: {
  car: CarConfig;
  accent: string;
  status: PreviewStatus;
  setStatus: (s: PreviewStatus) => void;
  retryCount: number;
  setRetryCount: (n: number) => void;
}) {
  const hasSlot = useRef(false);
  const mountedRef = useRef(true);

  // Acquire slot on mount, queue if unavailable
  useEffect(() => {
    mountedRef.current = true;

    function tryAcquire() {
      if (!mountedRef.current) return;
      if (tryAcquireCanvasSlot()) {
        hasSlot.current = true;
        setStatus("loading");
      } else {
        setStatus("waiting-slot");
        // Queue for next available slot
        const unsub = waitForCanvasSlot(() => {
          if (mountedRef.current) tryAcquire();
        });
        return unsub;
      }
    }

    tryAcquire();

    return () => {
      mountedRef.current = false;
      if (hasSlot.current) {
        releaseCanvasSlot();
        hasSlot.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show appropriate UI based on status
  if (status === "waiting-slot" || status === "acquiring") {
    return (
      <>
        <Silhouette2D car={car} accent={accent} />
        <StatusLabel text="Waiting for 3D slot…" tone="amber" />
      </>
    );
  }

  if (status === "failed") {
    return (
      <>
        <Silhouette2D car={car} accent={accent} />
        <StatusLabel
          text="3D failed — retry"
          tone="red"
          onClick={() => {
            setStatus("loading");
            setRetryCount(retryCount + 1);
          }}
        />
      </>
    );
  }

  // loading or loaded → render Canvas
  return (
    <StaticCanvas
      car={car}
      accent={accent}
      onLoaded={() => setStatus("loaded")}
      onFailed={() => setStatus("failed")}
      key={`${car.id}-${retryCount}`} // remount on retry
    />
  );
}

/* ------------------------------------------------------------------ */
/*  StaticCanvas — lightweight 3D preview (no OrbitControls, shadows)  */
/* ------------------------------------------------------------------ */

function StaticCanvas({
  car,
  accent,
  onLoaded,
  onFailed,
}: {
  car: CarConfig;
  accent: string;
  onLoaded: () => void;
  onFailed: () => void;
}) {
  return (
    <>
      <StatusLabel text="Loading 3D…" tone="yellow" />
      <Canvas
        camera={{ position: [0, 1.5, 4.5], fov: 40 }}
        gl={{ antialias: false }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={2.5} />
        <directionalLight position={[0, 6, 6]} intensity={4.0} />
        <directionalLight position={[-4, 3, -3]} intensity={2.0} />
        <directionalLight position={[4, 2, -3]} intensity={1.5} />
        <directionalLight position={[0, 2, -5]} intensity={2.5} />
        <directionalLight position={[0, 2, 5]} intensity={1.5} />

        {/* Light floor — lighter so dark cars stand out */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#2a2a38" roughness={0.5} />
        </mesh>

        <Suspense fallback={null}>
          <CanvasErrorBoundary onError={onFailed}>
            <NormalizedModel
              car={car}
              accent={accent}
              onReady={onLoaded}
            />
          </CanvasErrorBoundary>
        </Suspense>
      </Canvas>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  NormalizedModel                                                    */
/* ------------------------------------------------------------------ */

function NormalizedModel({
  car,
  accent,
  onReady,
}: {
  car: CarConfig;
  accent: string;
  onReady: () => void;
}) {
  const gltf = useGLTF(car.modelUrl);
  const override = CAR_OVERRIDES[car.id] ?? {};
  const box = useMemo(() => computeBox(gltf.scene), [gltf]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  const scale = TARGET_SIZE / box.maxDim;
  const finalScale = scale * (override.scaleMultiplier ?? 1);
  const rotationY = override.rotationY ?? 0;
  const floorY = -box.center.y * finalScale + box.size.y * 0.5 * finalScale;

  return (
    <group position={[0, floorY, 0]} scale={finalScale} rotation-y={rotationY}>
      <Clone object={gltf.scene} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Error Boundaries                                                   */
/* ------------------------------------------------------------------ */

class CanvasErrorBoundary extends React.Component<
  { onError: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Silhouette2D (pure HTML/CSS)                                       */
/* ------------------------------------------------------------------ */

function Silhouette2D({ car, accent }: { car: CarConfig; accent: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 bg-gradient-to-br from-zinc-800 to-zinc-900">
      <svg viewBox="0 0 120 40" className="w-full max-w-[180px] opacity-30">
        <rect x="10" y="22" width="100" height="12" rx="3" fill={accent} />
        <rect x="25" y="8" width="70" height="16" rx="6" fill={accent} />
        <circle cx="30" cy="34" r="6" fill={accent} />
        <circle cx="90" cy="34" r="6" fill={accent} />
      </svg>
      <p className="mt-2 text-xs text-white/30 font-bold">{car.name}</p>
      <p className="text-[10px] text-white/20">Class {car.class}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatusLabel                                                        */
/* ------------------------------------------------------------------ */

function StatusLabel({
  text,
  tone,
  onClick,
}: {
  text: string;
  tone: "amber" | "yellow" | "red" | "green";
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    amber: "text-amber-300/80 border-amber-300/20 bg-amber-300/[0.08]",
    yellow: "text-yellow-300/80 border-yellow-300/20 bg-yellow-300/[0.08]",
    red: "text-red-300/80 border-red-300/20 bg-red-300/[0.08]",
    green: "text-lime-300/80 border-lime-300/20 bg-lime-300/[0.08]",
  };

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`absolute bottom-1.5 left-2 right-2 rounded-full border px-2 py-0.5 text-center text-[9px] font-bold ${
        colors[tone]
      } ${onClick ? "cursor-pointer hover:opacity-80" : "pointer-events-none"}`}
    >
      {text}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const containerClass =
  "h-52 w-full rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 overflow-hidden relative";

function getAccent(carClass: string) {
  if (carClass === "S" || carClass === "A") return "#f97316";
  if (carClass.startsWith("B")) return "#d946ef";
  return "#84cc16";
}
