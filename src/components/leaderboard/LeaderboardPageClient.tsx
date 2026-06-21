"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const LeaderboardPageClientInner = dynamic(
  () =>
    import(
      "@/components/leaderboard/LeaderboardPageClientInner"
    ).then((mod) => ({ default: mod.LeaderboardPageClientInner })),
  { ssr: false },
);

export function LeaderboardPageClient() {
  return <LeaderboardPageClientInner />;
}
