"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";

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
  dryRunDepositStatus: "not_required" | "pending" | "submitted" | "confirmed" | "rejected";
  dbDepositStatus: string;
  joinedAt: string;
};

type DryRunTokenRoom = {
  roomId: string;
  tokenMint: string;
  stakeAmount: number;
  stakeAmountBaseUnits: string;
  depositWallet: string | null;
  vaultTokenAccount?: string | null;
  maxPlayers: number;
  minPlayers: number;
  playerCount: number;
  confirmedPlayerCount: number;
  depositedPlayerCount: number;
  allDepositsConfirmed: boolean;
  status: string;
  dryRunStatus: "waiting" | "full" | "deposits_pending" | "deposits_confirmed" | "ready_to_race" | "in_lobby" | "racing_mock" | "closed";
  creatorWalletAddress: string;
  createdAt: string;
  expiresAt: string;
  players: DryRunTokenRoomPlayer[];
};

export function TokenRoomDryRunLobbyClient() {
  const params = useParams<{ roomId: string }>();
  const router = useRouter();
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const walletAddress = publicKey?.toBase58() || "";
  const roomId = params?.roomId || "";

  const [room, setRoom] = useState<DryRunTokenRoom | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<"idle" | "working">("idle");
  const [depositStatus, setDepositStatus] = useState<"idle" | "building" | "signing" | "confirming" | "confirmed" | "failed">("idle");
  const [depositSignature, setDepositSignature] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);

  const loadRoom = useCallback(async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const query = walletAddress ? `?walletAddress=${encodeURIComponent(walletAddress)}` : "";
      const response = await fetch(`/api/token-rooms/${encodeURIComponent(roomId)}${query}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Dry-run room not found");
      }

      setRoom(payload.room || null);
      setMessage(payload.dryRunNotice || "RACETE deposits are real for this room; automatic payouts remain manual/admin-reviewed.");
      setStatus("ready");
    } catch (error) {
      console.warn("[TokenRoomDryRunLobby] load failed:", error);
      setRoom(null);
      setMessage(error instanceof Error ? error.message : "Dry-run room load failed.");
      setStatus("error");
    }
  }, [roomId, walletAddress]);

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
      setMessage(payload.dryRunNotice || "Token room action complete. Deposits are ledgered per room; payouts remain manual.");
    } catch (error) {
      console.warn(`[TokenRoomDryRunLobby] ${action} failed:`, error);
      setMessage(error instanceof Error ? error.message : `Dry-run ${action} failed.`);
    } finally {
      setActionStatus("idle");
    }
  }, [connected, roomId, walletAddress]);

  const depositRacete = useCallback(async () => {
    if (!connected || !publicKey || !walletAddress) {
      setMessage("Connect wallet to deposit RACETE for this room.");
      return;
    }
    if (!room) {
      setMessage("Room not loaded yet.");
      return;
    }
    if (!room.depositWallet) {
      setMessage("Deposit vault wallet is not configured. Deposits are unavailable.");
      return;
    }

    const currentPlayer = room.players.find((player) => player.walletAddress === walletAddress);
    if (!currentPlayer) {
      setMessage("Connected wallet is not a member of this token room.");
      return;
    }
    if (currentPlayer.dbDepositStatus === "confirmed") {
      setMessage("Deposit already confirmed for this room.");
      return;
    }

    setDepositStatus("building");
    setDepositSignature(null);
    setMessage("Preparing exact RACETE deposit transaction…");

    try {
      const intentResponse = await fetch("/api/token-rooms/deposit-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.roomId, walletAddress }),
      });
      const intent = await intentResponse.json();
      if (!intentResponse.ok) throw new Error(intent?.message || intent?.error || "Deposit intent failed");

      const mint = new PublicKey(intent.mint);
      const depositOwner = new PublicKey(intent.depositWallet);
      const sourceTokenAccount = getAssociatedTokenAddressSync(mint, publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
      const destinationTokenAccount = getAssociatedTokenAddressSync(mint, depositOwner, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      const sourceInfo = await connection.getAccountInfo(sourceTokenAccount, "confirmed");
      if (!sourceInfo) {
        throw new Error("Connected wallet does not have a RACETE Token-2022 token account for this mint.");
      }

      const transaction = new Transaction();
      const destinationInfo = await connection.getAccountInfo(destinationTokenAccount, "confirmed");
      if (!destinationInfo) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            destinationTokenAccount,
            depositOwner,
            mint,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      transaction.add(
        createTransferCheckedInstruction(
          sourceTokenAccount,
          mint,
          destinationTokenAccount,
          publicKey,
          Number(intent.amountBaseUnits),
          Number(intent.decimals),
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      );
      transaction.feePayer = publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;

      setDepositStatus("signing");
      setMessage("Wallet should show one exact RACETE transfer for this room only. No approval/delegate authority.");
      const signature = await sendTransaction(transaction, connection);
      setDepositSignature(signature);

      setDepositStatus("confirming");
      setMessage("Confirming RACETE deposit on-chain…");
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

      const confirmResponse = await fetch("/api/token-rooms/confirm-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.roomId, walletAddress, txSignature: signature }),
      });
      const confirmPayload = await confirmResponse.json();
      if (!confirmResponse.ok) throw new Error(confirmPayload?.message || confirmPayload?.error || "Deposit confirmation failed");

      setRoom(confirmPayload.room || null);
      setDepositStatus("confirmed");
      setMessage(confirmPayload.allDepositsConfirmed ? "Deposit confirmed. All deposits confirmed — room ready." : "Deposit confirmed. Waiting for other players.");
    } catch (error) {
      console.warn("[TokenRoomDryRunLobby] RACETE deposit failed:", error);
      setDepositStatus("failed");
      setMessage(error instanceof Error ? error.message : "RACETE deposit failed.");
    }
  }, [connected, connection, publicKey, room, sendTransaction, walletAddress]);

  useEffect(() => {
    if (roomId) void loadRoom();
  }, [loadRoom, roomId]);

  const isMember = Boolean(room?.players.some((player) => player.walletAddress === walletAddress));
  const currentPlayer = room?.players.find((player) => player.walletAddress === walletAddress) || null;
  const userDepositConfirmed = currentPlayer?.dbDepositStatus === "confirmed";
  const isReadyForRace = Boolean(room && (room.allDepositsConfirmed || room.dryRunStatus === "ready_to_race"));
  const canDeposit = Boolean(connected && isMember && room?.depositWallet && !userDepositConfirmed && depositStatus !== "building" && depositStatus !== "signing" && depositStatus !== "confirming");
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
                  Token room lobby
                </span>
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-100">
                  Real RACETE deposits · manual payouts
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-black md:text-5xl">Token room lobby metadata</h1>
              <p className="mt-3 max-w-3xl text-sm text-white/60">
                RACETE deposits are real in this MVP. Deposits are recorded per room/player in the DB ledger.
                Automatic payouts are not live; payouts are admin-reviewed/manual. Free Multiplayer Race Cash rewards remain separate.
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
              Token room unavailable. No additional token action was attempted.
            </div>
          )}

          {room && (
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="font-mono text-xs text-white/40">{room.roomId}</p>
                <h2 className="mt-2 text-2xl font-black">{formatRacete(room.stakeAmount)} token room</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Metric label="Players" value={`${room.playerCount}/${room.maxPlayers}`} />
                  <Metric label="Deposits" value={`${room.depositedPlayerCount}/${room.playerCount}`} />
                  <Metric label="Status" value={room.dryRunStatus.replaceAll("_", " ")} />
                  <Metric label="Stake" value={formatRacete(room.stakeAmount)} />
                  <Metric label="Vault wallet" value={room.depositWallet ? shortAddress(room.depositWallet) : "Not configured"} muted={!room.depositWallet} />
                  <Metric label="Token mint" value={shortAddress(room.tokenMint)} muted />
                </div>
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100/80">
                  This deposit is for this room only. RACETE deposits are real. Payouts are admin-reviewed/manual in this MVP.
                  No automatic treasury, weekly, winner, refund, or payout transfer happens in Phase C.2.
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

              <div className="lg:col-span-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-100/70">Real RACETE deposit</p>
                <h3 className="mt-2 text-2xl font-black">Deposit {formatRacete(room.stakeAmount)}</h3>
                <p className="mt-2 text-sm text-amber-50/70">
                  This wallet transaction transfers exactly {formatRacete(room.stakeAmount)} to the shared deposit vault.
                  The backend ledger links the signature to this room and this wallet only. Automatic payouts are not live yet.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Metric label="Your deposit" value={userDepositConfirmed ? "Confirmed" : currentPlayer ? currentPlayer.dbDepositStatus : "Not a member"} muted={!userDepositConfirmed} />
                  <Metric label="Base units" value={room.stakeAmountBaseUnits} muted />
                  <Metric label="Vault" value={room.depositWallet ? shortAddress(room.depositWallet) : "Not configured"} muted={!room.depositWallet} />
                </div>
                {depositSignature && (
                  <p className="mt-3 break-all rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs text-white/60">
                    tx: {depositSignature}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => void depositRacete()}
                    disabled={!canDeposit}
                    className="rounded-full border border-amber-200/30 bg-amber-300 px-5 py-3 text-xs font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {depositStatus === "building" || depositStatus === "signing" || depositStatus === "confirming"
                      ? "Depositing…"
                      : userDepositConfirmed
                        ? "Deposit confirmed"
                        : "Deposit RACETE"}
                  </button>
                  {room.allDepositsConfirmed && (
                    <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-3 text-xs font-black text-lime-100">
                      All deposits confirmed — room ready
                    </span>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-100/60">Dry-run race handoff</p>
                <p className="mt-2 text-sm text-cyan-50/65">
                  The handoff uses existing multiplayer UI with tokenRoomId metadata only. Race start is available only after deposits are confirmed.
                  It does not execute payouts or settle RACETE automatically.
                </p>
                {!connected && (
                  <p className="mt-3 text-xs text-amber-200/80">Connect wallet to deposit/start this token room. Deposit uses a wallet-signed transfer; start/handoff does not request a payout signature.</p>
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
                    Token room race started. No automatic RACETE payout will run from this MVP flow.
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
