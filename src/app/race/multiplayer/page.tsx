"use client";

import dynamic from "next/dynamic";
import { MultiplayerErrorBoundary } from "@/components/race/MultiplayerRaceClient";

const MultiplayerRaceClient = dynamic(
  () => import("@/components/race/MultiplayerRaceClient").then((mod) => ({ default: mod.MultiplayerRaceClient })),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#050509] p-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-lime-300 border-t-transparent" />
          <p className="text-lg font-bold text-white/50">Loading multiplayer...</p>
        </div>
      </main>
    ),
  },
);

export default function MultiplayerRacePage() {
  return (
    <MultiplayerErrorBoundary>
      <MultiplayerRaceClient />
    </MultiplayerErrorBoundary>
  );
}
