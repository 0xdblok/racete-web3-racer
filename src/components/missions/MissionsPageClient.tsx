"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { shortWallet } from "@/lib/format";
import { MissionCard } from "./MissionCard";
import {
  MissionFilters,
  type MissionFilter,
} from "./MissionFilters";
import type { ObjectiveState } from "@/config/objectives";

type Status = "idle" | "loading" | "ready" | "error";

export function MissionsPageClient() {
  const { publicKey, connected } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<ObjectiveState[]>([]);
  const [filter, setFilter] = useState<MissionFilter>("all");
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<{
    tone: "normal" | "success" | "error";
    message: string;
  } | null>(null);

  const walletAddress = publicKey?.toBase58() || "";

  const fetchObjectives = useCallback(async () => {
    if (!walletAddress) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(
        `/api/race/objectives?walletAddress=${encodeURIComponent(walletAddress)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch objectives");
      setObjectives(data.objectives || []);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load missions");
      setStatus("error");
    }
  }, [walletAddress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (connected && walletAddress) void fetchObjectives();
      if (!connected) {
        setObjectives([]);
        setStatus("idle");
        setError(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connected, fetchObjectives, walletAddress]);

  const handleClaim = useCallback(
    async (objectiveId: string) => {
      if (!walletAddress || claimingId) return;
      setClaimingId(objectiveId);
      setClaimMessage({ tone: "normal", message: "Claiming reward..." });
      try {
        const res = await fetch("/api/race/objectives/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, objectiveId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Claim failed");

        // Update local state
        setObjectives((prev) =>
          prev.map((obj) =>
            obj.objective.id === objectiveId
              ? {
                  ...obj,
                  status: "claimed" as const,
                  claimedAt: new Date().toISOString(),
                }
              : obj,
          ),
        );
        setClaimMessage({
          tone: "success",
          message: `+${data.rewardAmount} Race Cash claimed!`,
        });
      } catch (err) {
        setClaimMessage({
          tone: "error",
          message: err instanceof Error ? err.message : "Claim failed",
        });
      } finally {
        setClaimingId(null);
      }
    },
    [claimingId, walletAddress],
  );

  const filteredObjectives = useMemo(() => {
    if (!connected || !walletAddress) return [];
    switch (filter) {
      case "all":
        return objectives;
      case "claimable":
        return objectives.filter((o) => o.status === "completed");
      case "completed":
        return objectives.filter(
          (o) => o.status === "completed" || o.status === "claimed",
        );
      default:
        return objectives.filter(
          (o) => o.difficulty === filter,
        );
    }
  }, [objectives, filter, connected, walletAddress]);

  const claimableCount = useMemo(
    () => objectives.filter((o) => o.status === "completed").length,
    [objectives],
  );

  // ── Not connected ──
  if (!connected) {
    return (
      <MissionsShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
            Wallet required
          </p>
          <h1 className="mt-3 text-4xl font-black text-white">
            Connect wallet to view missions.
          </h1>
          <p className="mt-4 text-white/60">
            Hard objectives track your racing progress and reward Race Cash.
          </p>
          <div className="mt-6 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      </MissionsShell>
    );
  }

  // ── Loading ──
  if (status === "loading") {
    return (
      <MissionsShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="text-white/60">
            Loading missions for {shortWallet(walletAddress)}...
          </p>
        </div>
      </MissionsShell>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <MissionsShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-red-200">{error}</p>
          <button
            onClick={() => void fetchObjectives()}
            className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      </MissionsShell>
    );
  }

  // ── Ready ──
  return (
    <MissionsShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white">Missions</h1>
          <p className="mt-2 text-white/55">
            Complete hard racing objectives to earn Race Cash
          </p>
        </div>
        {claimableCount > 0 && (
          <span className="rounded-full border border-lime-300/40 bg-lime-300/15 px-4 py-2 text-sm font-bold text-lime-200">
            {claimableCount} claimable
          </span>
        )}
      </div>

      {claimMessage && (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${
            claimMessage.tone === "error"
              ? "border-red-400/30 bg-red-500/10 text-red-200"
              : claimMessage.tone === "success"
                ? "border-lime-300/30 bg-lime-300/10 text-lime-200"
                : "border-white/10 bg-white/[0.04] text-white/70"
          }`}
        >
          {claimMessage.message}
        </div>
      )}

      <MissionFilters active={filter} onChange={setFilter} />

      {filteredObjectives.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/50">
          No missions found for this filter.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredObjectives.map((state) => (
            <MissionCard
              key={state.objective.id}
              state={state}
              onClaim={handleClaim}
              claiming={claimingId === state.objective.id}
              walletAddress={walletAddress}
            />
          ))}
        </div>
      )}
    </MissionsShell>
  );
}

function MissionsShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#050509] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-xl font-black tracking-[0.35em] text-fuchsia-300"
          >
            RACETE
          </Link>
          <div className="flex items-center gap-3">
            <Link
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              href="/"
            >
              Home
            </Link>
            <Link
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              href="/garage"
            >
              Garage
            </Link>
            <Link
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              href="/race"
            >
              Race
            </Link>
            <Link
              className="rounded-full border border-lime-300/40 bg-lime-300/15 px-4 py-2 text-sm font-bold text-lime-200 hover:bg-lime-300/25"
              href="/leaderboard"
            >
              Leaderboard
            </Link>
            <WalletMultiButton />
          </div>
        </nav>
        {children}
      </div>
    </main>
  );
}
