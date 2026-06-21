"use client";

import dynamic from "next/dynamic";

const WeeklyPageClientInner = dynamic(
  () =>
    import("@/components/weekly/WeeklyPageClient").then((mod) => ({
      default: mod.WeeklyPageClient,
    })),
  { ssr: false },
);

export default function WeeklyPage() {
  return <WeeklyPageClientInner />;
}
