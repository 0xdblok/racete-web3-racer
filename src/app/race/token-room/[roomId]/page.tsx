"use client";

import dynamic from "next/dynamic";

const TokenRoomDryRunLobbyClient = dynamic(
  () => import("@/components/token-rooms/TokenRoomDryRunLobbyClient").then((mod) => ({
    default: mod.TokenRoomDryRunLobbyClient,
  })),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#050509] p-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-fuchsia-300 border-t-transparent" />
          <p className="text-lg font-bold text-white/50">Loading dry-run token room...</p>
        </div>
      </main>
    ),
  },
);

export default function TokenRoomDryRunLobbyPage() {
  return <TokenRoomDryRunLobbyClient />;
}
