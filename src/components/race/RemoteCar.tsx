"use client";

import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CARS } from "@/config/cars";
import { CarModel } from "@/components/race/CarModel";
import type { LobbyPlayer } from "@/types/multiplayer";
import type { PlayerCar } from "@/types/game";
import { resolveCarGameplayStats } from "@/lib/car-gameplay-stats";

type RemoteCarProps = {
  player: LobbyPlayer;
};

const TELEPORT_DISTANCE = 30;
const POSITION_SMOOTHNESS = 8;
const ROTATION_SMOOTHNESS = 10;

export function RemoteCar({ player }: RemoteCarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const currentPosition = useRef(new THREE.Vector3(player.x, player.y, player.z));
  const currentYaw = useRef(player.yaw || 0);

  const car = useMemo(() => CARS.find((c) => c.id === player.selectedCarId) || CARS[0], [player.selectedCarId]);

  const selectedCar = useMemo<PlayerCar>(() => ({
    id: `remote-${player.sessionId}`,
    wallet_address: player.walletAddress,
    car_id: car.id,
    engine_level: 1,
    tires_level: 1,
    nitro_level: 1,
    handling_level: 1,
    power_rating: player.powerRating || car.basePowerRating,
    is_selected: false,
  }), [car.basePowerRating, car.id, player.powerRating, player.sessionId, player.walletAddress]);

  const gameplayStats = useMemo(() => resolveCarGameplayStats(car, selectedCar), [car, selectedCar]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const target = new THREE.Vector3(player.x || 0, player.y || 0.3, player.z || 0);
    const dist = currentPosition.current.distanceTo(target);

    if (dist > TELEPORT_DISTANCE) {
      currentPosition.current.copy(target);
    } else {
      const alpha = 1 - Math.exp(-POSITION_SMOOTHNESS * delta);
      currentPosition.current.lerp(target, alpha);
    }

    const yawDelta = shortestAngleDelta(currentYaw.current, player.yaw || 0);
    currentYaw.current += yawDelta * (1 - Math.exp(-ROTATION_SMOOTHNESS * delta));

    group.position.copy(currentPosition.current);
    group.rotation.set(0, currentYaw.current, 0);
  });

  const wallet = player.walletAddress
    ? `${player.walletAddress.slice(0, 4)}…${player.walletAddress.slice(-4)}`
    : "remote";

  return (
    <group ref={groupRef}>
      <CarModel car={car} selectedCar={selectedCar} gameplayStats={gameplayStats} isDriving />
      <Html position={[0, 2.4, 0]} center distanceFactor={18} occlude={false}>
        <div className="pointer-events-none rounded-full border border-cyan-300/30 bg-black/70 px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-cyan-100 shadow-lg shadow-cyan-500/20 backdrop-blur">
          <div>{wallet}</div>
          <div className="text-[9px] text-lime-200/80">{player.carName || car.name} · {player.carClass} · PR {player.powerRating || car.basePowerRating}</div>
        </div>
      </Html>
    </group>
  );
}

function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
