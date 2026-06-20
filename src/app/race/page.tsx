"use client";

import dynamic from "next/dynamic";

const RacePageClient = dynamic(
  () => import("@/components/race/RacePageClient").then((mod) => ({ default: mod.RacePageClient })),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#050509] p-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-lime-300 border-t-transparent" />
          <p className="text-lg font-bold text-white/50">Loading race engine...</p>
        </div>
      </main>
    ),
  },
);

export default function RacePage() {
  return <RacePageClient />;
}
