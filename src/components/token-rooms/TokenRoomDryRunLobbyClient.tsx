"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatRacete(amount: number): string {
  return `${amount.toLocaleString("en-US")} RACETE`;
}

type DryRunTokenRoomPlayer = {
  walletAddress: string;
  isCreator: boolean;
  status: string;
  dryRunDepositStatus: "not_required";
  dbDepositStatus: string;
  joinedAt: string;
};

type DryRunTokenRoom = {
  roomId: string;
  tokenMint: string;
  stakeAmount: number;
  maxPlayers: number;
  minPlayers: number;
  playerCount: number;
  confirmedPlayerCount: number;
  status: string;
  dryRunStatus: "waiting" | "full" | "in_lobby" | "racing_mock" | "closed";
  creatorWalletAddress: string;
  createdAt: string;
  expiresAt: string;
  players: DryRunTokenRoomPlayer[];
};

export function TokenRoomDryRunLobbyClient() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || "";
  const roomId = params?.roomId || "";

  const [room, setRoom] = useState<DryRunTokenRoom | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<"idle" | "working">("idle");
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  const loadRoom = useCallback(async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch(`/api/token-rooms/${encodeURIComponent(roomId)}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Dry-run room not found");
      }

      setRoom(payload.room || null);
      setMessage(payload.dryRunNotice || "Dry-run only. No RACETE deposit, transfer, or payout will happen.");
      setStatus("ready");
    } catch (error) {
      console.warn("[TokenRoomDryRunLobby] load failed:", error);
      setRoom(null);
      setMessage(error instanceof Error ? error.message : "Dry-run room load failed.");
      setStatus("error");
    }
  }, [roomId]);

  const postRoomAction = useCallback(async (action: "enter-lobby" | "start-dry-run") => {
    if (!connected || !walletAddress) {
      setMessage("Connect wallet to use this dry-run lobby. No signature will be requested.");
      return;
    }

    setActionStatus("working");
    setMessage(null);

    try {
      const response = await fetch(`/api/token-rooms/${encodeURIComponent(roomId)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `Dry-run ${action} failed`);
      }

      setRoom(payload.room || null);
      setNextUrl(payload.nextUrl || null);
      setMessage(payload.dryRunNotice || "Dry-run action complete. No RACETE moved.");
    } catch (error) {
      console.warn(`[TokenRoomDryRunLobby] ${action} failed:`, error);
      setMessage(error instanceof Error ? error.message : `Dry-run ${action} failed.`);
    } finally {
      setActionStatus("idle");
    }
  }, [connected, roomId, walletAddress]);

  useEffect(() => {
    if (roomId) void loadRoom();
  }, [loadRoom, roomId]);

  const isMember = Boolean(room?.players.some((player) => player.walletAddress === walletAddress));
  const isReadyForRace = Boolean(room && (room.dryRunStatus === "full" || room.dryRunStatus === "in_lobby"));
  const canEnterLobby = connected && isMember && room?.dryRunStatus !== "closed" && room?.dryRunStatus !== "racing_mock";
  const canStartDryRun = connected && isMember && isReadyForRace && actionStatus !== "working";

  return (
    <main className="min-h-screen bg-[#050509] px-6 py-8 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/race/multiplayer" className="text-sm font-black uppercase tracking-[0.3em] text-fuchsia-200">
            ← Multiplayer
          </Link>
          <Link
            href="/race/multiplayer"
            className="rounded-full border border-cyan-300/30 bg-cyan-300/[0.08] px-4 py-2 text-sm font-bold text-cyan-100"
          >
            Back to Token Rooms
          </Link>
        </nav>

        <section className="rounded-[2rem] border border-fuchsia-300/20 bg-fuchsia-300/[0.06] p-6 shadow-2xl shadow-fuchsia-950/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-fuchsia-100">
                  Dry-run token room lobby
                </span>
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-100">
                  No token movement
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black md:text-5xl">Token room lobby metadata</h1>
              <p className="mt-3 max-w-3xl text-sm text-white/60">
                Dry-run token room race. Results are for testing only. No RACETE deposit, transfer, or payout will happen.
                Free Multiplayer Race Cash rewards remain separate.
              </p>
            </div>
            <button
              onClick={() => void loadRoom()}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-black text-white/70 transition hover:bg-white/[0.10]"
            >
              {status === "loading" ? "Refreshing…" : "Refresh lobby"}
            </button>
          </div>

          {message && (
            <p className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
              {message}
            </p>
          )}

          {status === "loading" && <p className="mt-6 text-white/45">Loading dry-run token room…</p>}

          {status === "error" && (
            <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/10 p-5 text-red-100/80">
              Dry-run room unavailable. No token movement was attempted.
            </div>
          )}

          {room && (
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="font-mono text-xs text-white/40">{room.roomId}</p>
                <h2 className="mt-2 text-2xl font-black">{formatRacete(room.stakeAmount)} dry-run room</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Metric label="Players" value={`${room.playerCount}/${room.maxPlayers}`} />
                  <Metric label="Status" value={room.dryRunStatus.replace("_", " ")} />
                  <Metric label="DB status" value={room.status} />
                  <Metric label="Deposit" value="Not required" muted />
                </div>
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100/80">
                  Dry-run only. No RACETE deposit requested. No token transfer. No payout. No wallet signature request.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">Players</p>
                <div className="mt-4 space-y-2">
                  {room.players.map((player) => (
                    <div key={player.walletAddress} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-white/75">{shortAddress(player.walletAddress)}</span>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
                          {player.isCreator ? "creator" : "player"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/40">
                        {player.status} · deposit {player.dryRunDepositStatus}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-100/60">Dry-run race handoff</p>
                <p className="mt-2 text-sm text-cyan-50/65">
                  The handoff uses existing multiplayer UI with tokenRoomId metadata only. It does not create escrow, request a wallet signature, or settle RACETE.
                </p>
                {!connected && (
                  <p className="mt-3 text-xs text-amber-200/80">Connect wallet to enter/start the dry-run lobby. No signature popup should appear.</p>
                )}
                {connected && !isMember && (
                  <p className="mt-3 text-xs text-amber-200/80">Connected wallet is not a member of this dry-run token room.</p>
                )}
                {room.dryRunStatus === "full" && (
                  <p className="mt-3 rounded-xl border border-lime-300/25 bg-lime-300/10 px-3 py-2 text-xs font-bold text-lime-100">
                    Room full — ready for dry-run race.
                  </p>
                )}
                {room.dryRunStatus === "racing_mock" && (
                  <p className="mt-3 rounded-xl border border-lime-300/25 bg-lime-300/10 px-3 py-2 text-xs font-bold text-lime-100">
                    Dry-run token room race started. Results are for testing only. No RACETE payout.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => void postRoomAction("enter-lobby")}
                    disabled={!canEnterLobby || actionStatus === "working"}
                    className="rounded-full border border-fuchsia-200/30 bg-fuchsia-300 px-5 py-3 text-xs font-black text-black transition hover:bg-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {actionStatus === "working" ? "Working…" : "Enter dry-run lobby — no signature"}
                  </button>
                  <button
                    onClick={() => void postRoomAction("start-dry-run")}
                    disabled={!canStartDryRun}
                    className="rounded-full border border-lime-200/30 bg-lime-300 px-5 py-3 text-xs font-black text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Start dry-run race — no payout
                  </button>
                  {nextUrl && (
                    <button
                      onClick={() => router.push(nextUrl)}
                      className="rounded-full border border-cyan-200/30 bg-cyan-300 px-5 py-3 text-xs font-black text-black transition hover:bg-cyan-200"
                    >
                      Open existing multiplayer with metadata
                    </button>
                  )}
                  {!nextUrl && room.dryRunStatus === "racing_mock" && (
                    <Link
                      href={`/race/multiplayer?tokenRoomId=${encodeURIComponent(room.roomId)}`}
                      className="rounded-full border border-cyan-200/30 bg-cyan-300 px-5 py-3 text-xs font-black text-black transition hover:bg-cyan-200"
                    >
                      Open existing multiplayer with metadata
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className={`mt-1 text-lg font-black ${muted ? "text-white/45" : "text-white"}`}>{value}</p>
    </div>
  );
}
