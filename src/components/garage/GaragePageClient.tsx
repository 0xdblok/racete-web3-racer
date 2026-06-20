"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CARS } from "@/config/cars";
import { RACE_CASH_PACKS, type RaceCashPack } from "@/config/economy";
import { getUpgradePrice, MAX_UPGRADE_LEVEL, UPGRADE_TYPES, type UpgradeType } from "@/config/upgrades";
import { publicEnv } from "@/lib/env";
import { formatNumber, shortWallet } from "@/lib/format";
import type { PlayerInitResponse } from "@/types/game";
import { GarageShowroom } from "@/components/garage/GarageShowroom";

type Status = "idle" | "loading" | "ready" | "error";
type PaymentStatus = { tone: "normal" | "error" | "success"; message: string } | null;

type CreateIntentResponse = {
  paymentIntentId: string;
  tokenAmount: number;
  tokenMint: string;
  treasuryWallet: string;
  raceCashAmount: number;
  packName: string;
  carName?: string;
  carId?: string;
  upgradeType?: string;
};

function tokenAmountToRaw(amount: number, decimals: number) {
  const [whole, fraction = ""] = String(amount).split(".");
  const normalizedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) + BigInt(normalizedFraction || "0");
}

export function GaragePageClient() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PlayerInitResponse | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tokenBalanceStatus, setTokenBalanceStatus] = useState("idle");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(null);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [activeCarId, setActiveCarId] = useState<string | null>(null);
  const [activeUpgradeKey, setActiveUpgradeKey] = useState<string | null>(null);
  const [focusedCarId, setFocusedCarId] = useState<string | null>(null);
  const [devStatus, setDevStatus] = useState<{ devToolsEnabled: boolean; devWalletAddresses: string[] } | null>(null);

  const walletAddress = publicKey?.toBase58() || "";
  const ownedCarIds = useMemo(() => new Set(state?.ownedCars.map((car) => car.car_id) || []), [state]);
  const ownedCarByCatalogId = useMemo(() => new Map((state?.ownedCars || []).map((car) => [car.car_id, car])), [state]);
  const selectedCarId = state?.selectedCar?.car_id || null;
  const totalRaceCash = Number(state?.player.earned_race_cash || 0) + Number(state?.player.purchased_race_cash || 0);

  const devToolsEnabled = Boolean(devStatus?.devToolsEnabled);
  const isDevWallet = walletAddress ? (devStatus?.devWalletAddresses || []).includes(walletAddress) : false;

  const refreshTokenBalance = useCallback(async () => {
    if (!publicKey || !publicEnv.tokenMint) {
      setTokenBalance(0);
      setTokenBalanceStatus(publicEnv.tokenMint ? "idle" : "missing token mint");
      return;
    }
    setTokenBalanceStatus("loading");
    try {
      const mint = new PublicKey(publicEnv.tokenMint);
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      const account = await connection.getTokenAccountBalance(ata).catch(() => null);
      setTokenBalance(account?.value.uiAmount || 0);
      setTokenBalanceStatus("ready");
    } catch (err) {
      setTokenBalance(0);
      setTokenBalanceStatus(err instanceof Error ? err.message : "token balance failed");
    }
  }, [connection, publicKey]);

  const fetchDevStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/status");
      if (res.ok) {
        const data = await res.json();
        setDevStatus(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  // Fetch dev status on mount - wrapped in setTimeout to avoid sync setState in effect
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDevStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDevStatus]);

  const initPlayer = useCallback(async () => {
    if (!walletAddress) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/player/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Player init failed");
      setState(data);
      setStatus("ready");
      await refreshTokenBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Player init failed");
      setStatus("error");
    }
  }, [refreshTokenBalance, walletAddress]);

  const buyRaceCashPack = useCallback(
    async (pack: RaceCashPack) => {
      if (!publicKey || !walletAddress) return;
      if (!publicEnv.mockTokenMode && (!publicEnv.tokenMint || !publicEnv.treasuryWallet)) {
        setPaymentStatus({ tone: "error", message: "Token mint or treasury wallet is not configured." });
        return;
      }
      if (!publicEnv.mockTokenMode && tokenBalance < pack.tokenAmount) {
        setPaymentStatus({ tone: "error", message: `Not enough token balance for ${pack.name}.` });
        return;
      }
      setActivePackId(pack.id);
      setPaymentStatus({ tone: "normal", message: `Creating payment intent for ${pack.name}...` });
      try {
        const intentRes = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, actionType: "buy_race_cash", itemId: pack.id }),
        });
        const intent = (await intentRes.json()) as CreateIntentResponse & { error?: string };
        if (!intentRes.ok) throw new Error(intent.error || "Create payment intent failed");

        if (publicEnv.mockTokenMode) {
          setPaymentStatus({ tone: "normal", message: "Dev mock payment mode: confirming without wallet transaction..." });
          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: intent.paymentIntentId, mockConfirmation: { type: "RACETE_MOCK_TOKEN_PAYMENT", walletAddress } }),
          });
          const confirmation = await confirmRes.json();
          if (!confirmRes.ok) throw new Error(confirmation.error || "Mock payment verification failed");
          setPaymentStatus({ tone: "success", message: `Dev mock payment confirmed. Added ${formatNumber(intent.raceCashAmount)} purchased Race Cash.` });
          await initPlayer();
          return;
        }

        setPaymentStatus({ tone: "normal", message: "Open your wallet and approve the SPL token transfer..." });
        const mint = new PublicKey(intent.tokenMint);
        const treasury = new PublicKey(intent.treasuryWallet);
        const sourceAta = getAssociatedTokenAddressSync(mint, publicKey);
        const treasuryAta = getAssociatedTokenAddressSync(mint, treasury);
        const rawAmount = tokenAmountToRaw(intent.tokenAmount, publicEnv.tokenDecimals);
        const transaction = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(publicKey, treasuryAta, treasury, mint),
          createTransferCheckedInstruction(sourceAta, mint, treasuryAta, publicKey, rawAmount, publicEnv.tokenDecimals),
        );
        const signature = await sendTransaction(transaction, connection);
        setPaymentStatus({ tone: "normal", message: "Transaction sent. Waiting for confirmation..." });
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");
        setPaymentStatus({ tone: "normal", message: "Verifying payment on backend..." });
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: intent.paymentIntentId, signature }),
        });
        const confirmation = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmation.error || "Payment verification failed");
        setPaymentStatus({ tone: "success", message: `${intent.packName} confirmed. Added ${formatNumber(intent.raceCashAmount)} purchased Race Cash.` });
        await initPlayer();
      } catch (err) {
        setPaymentStatus({ tone: "error", message: err instanceof Error ? err.message : "Payment failed" });
      } finally {
        setActivePackId(null);
      }
    },
    [connection, initPlayer, publicKey, sendTransaction, tokenBalance, walletAddress],
  );

  const buyCar = useCallback(
    async (carId: string) => {
      if (!publicKey || !walletAddress) return;
      const car = CARS.find((item) => item.id === carId);
      if (!car) return;
      setActiveCarId(car.id);
      setPaymentStatus({ tone: "normal", message: `Buying ${car.name}...` });
      try {
        if (car.priceToken <= 0) {
          const res = await fetch("/api/cars/buy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, carId: car.id }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Car purchase failed");
          setState(data);
          setPaymentStatus({ tone: "success", message: `${car.name} added to your garage.` });
          return;
        }
        if (!publicEnv.mockTokenMode && (!publicEnv.tokenMint || !publicEnv.treasuryWallet)) {
          throw new Error("Token mint or treasury wallet is not configured.");
        }
        if (!publicEnv.mockTokenMode && tokenBalance < car.priceToken) {
          throw new Error(`Not enough token balance for ${car.name}.`);
        }
        const intentRes = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, actionType: "buy_car", carId: car.id }),
        });
        const intent = (await intentRes.json()) as CreateIntentResponse & { error?: string };
        if (!intentRes.ok) throw new Error(intent.error || "Create car payment intent failed");

        if (publicEnv.mockTokenMode) {
          setPaymentStatus({ tone: "normal", message: "Dev mock payment mode: confirming premium car without wallet transaction..." });
          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: intent.paymentIntentId, mockConfirmation: { type: "RACETE_MOCK_TOKEN_PAYMENT", walletAddress } }),
          });
          const confirmation = await confirmRes.json();
          if (!confirmRes.ok) throw new Error(confirmation.error || "Mock premium car payment failed");
          setState({ player: confirmation.player, ownedCars: confirmation.ownedCars, selectedCar: confirmation.selectedCar });
          setPaymentStatus({ tone: "success", message: `${car.name} bought with dev mock token payment.` });
          return;
        }

        setPaymentStatus({ tone: "normal", message: `Open your wallet to approve ${car.name} token payment...` });
        const mint = new PublicKey(intent.tokenMint);
        const treasury = new PublicKey(intent.treasuryWallet);
        const sourceAta = getAssociatedTokenAddressSync(mint, publicKey);
        const treasuryAta = getAssociatedTokenAddressSync(mint, treasury);
        const rawAmount = tokenAmountToRaw(intent.tokenAmount, publicEnv.tokenDecimals);
        const transaction = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(publicKey, treasuryAta, treasury, mint),
          createTransferCheckedInstruction(sourceAta, mint, treasuryAta, publicKey, rawAmount, publicEnv.tokenDecimals),
        );
        const signature = await sendTransaction(transaction, connection);
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: intent.paymentIntentId, signature }),
        });
        const confirmation = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmation.error || "Premium car payment failed");
        setState({ player: confirmation.player, ownedCars: confirmation.ownedCars, selectedCar: confirmation.selectedCar });
        setPaymentStatus({ tone: "success", message: `${car.name} added to your garage.` });
        await refreshTokenBalance();
      } catch (err) {
        setPaymentStatus({ tone: "error", message: err instanceof Error ? err.message : "Car purchase failed" });
      } finally {
        setActiveCarId(null);
      }
    },
    [connection, publicKey, refreshTokenBalance, sendTransaction, tokenBalance, walletAddress],
  );

  const selectCar = useCallback(
    async (carId: string) => {
      if (!walletAddress) return;
      setActiveCarId(carId);
      setPaymentStatus({ tone: "normal", message: "Selecting car..." });
      try {
        const res = await fetch("/api/cars/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, carId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Car select failed");
        setState(data);
        setPaymentStatus({ tone: "success", message: "Selected car updated." });
      } catch (err) {
        setPaymentStatus({ tone: "error", message: err instanceof Error ? err.message : "Car select failed" });
      } finally {
        setActiveCarId(null);
      }
    },
    [walletAddress],
  );

  const upgradeCar = useCallback(
    async (playerCarId: string, upgradeType: UpgradeType) => {
      if (!publicKey || !walletAddress) return;
      const key = `${playerCarId}:${upgradeType}`;
      const ownedCar = state?.ownedCars.find((car) => car.id === playerCarId);
      const currentLevel = Number(ownedCar?.[`${upgradeType}_level` as keyof typeof ownedCar] || 1);
      const price = getUpgradePrice(currentLevel);
      if (!price) return;
      setActiveUpgradeKey(key);
      setPaymentStatus({ tone: "normal", message: `Upgrading ${upgradeType} to level ${price.nextLevel}...` });
      try {
        if (price.token <= 0) {
          const res = await fetch("/api/cars/upgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, playerCarId, upgradeType }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upgrade failed");
          setState(data);
          setPaymentStatus({ tone: "success", message: `${upgradeType} upgraded to level ${price.nextLevel}.` });
          return;
        }
        if (!publicEnv.mockTokenMode && (!publicEnv.tokenMint || !publicEnv.treasuryWallet)) {
          throw new Error("Token mint or treasury wallet is not configured.");
        }
        if (!publicEnv.mockTokenMode && tokenBalance < price.token) {
          throw new Error(`Not enough token balance for ${upgradeType} upgrade.`);
        }
        const intentRes = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, actionType: "upgrade_car", playerCarId, upgradeType }),
        });
        const intent = (await intentRes.json()) as CreateIntentResponse & { error?: string };
        if (!intentRes.ok) throw new Error(intent.error || "Create upgrade payment intent failed");

        if (publicEnv.mockTokenMode) {
          setPaymentStatus({ tone: "normal", message: "Dev mock payment mode: confirming premium upgrade without wallet transaction..." });
          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId: intent.paymentIntentId, mockConfirmation: { type: "RACETE_MOCK_TOKEN_PAYMENT", walletAddress } }),
          });
          const confirmation = await confirmRes.json();
          if (!confirmRes.ok) throw new Error(confirmation.error || "Mock premium upgrade failed");
          setState({ player: confirmation.player, ownedCars: confirmation.ownedCars, selectedCar: confirmation.selectedCar });
          setPaymentStatus({ tone: "success", message: `${upgradeType} upgraded to level ${price.nextLevel} with dev mock token payment.` });
          return;
        }

        setPaymentStatus({ tone: "normal", message: `Open your wallet to approve ${upgradeType} token payment...` });
        const mint = new PublicKey(intent.tokenMint);
        const treasury = new PublicKey(intent.treasuryWallet);
        const sourceAta = getAssociatedTokenAddressSync(mint, publicKey);
        const treasuryAta = getAssociatedTokenAddressSync(mint, treasury);
        const rawAmount = tokenAmountToRaw(intent.tokenAmount, publicEnv.tokenDecimals);
        const transaction = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(publicKey, treasuryAta, treasury, mint),
          createTransferCheckedInstruction(sourceAta, mint, treasuryAta, publicKey, rawAmount, publicEnv.tokenDecimals),
        );
        const signature = await sendTransaction(transaction, connection);
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed");
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: intent.paymentIntentId, signature }),
        });
        const confirmation = await confirmRes.json();
        if (!confirmRes.ok) throw new Error(confirmation.error || "Premium upgrade failed");
        setState({ player: confirmation.player, ownedCars: confirmation.ownedCars, selectedCar: confirmation.selectedCar });
        setPaymentStatus({ tone: "success", message: `${upgradeType} upgraded to level ${price.nextLevel}.` });
        await refreshTokenBalance();
      } catch (err) {
        setPaymentStatus({ tone: "error", message: err instanceof Error ? err.message : "Upgrade failed" });
      } finally {
        setActiveUpgradeKey(null);
      }
    },
    [connection, publicKey, refreshTokenBalance, sendTransaction, state?.ownedCars, tokenBalance, walletAddress],
  );

  const devGrant = useCallback(async () => {
    if (!walletAddress) return;
    setStatus("loading");
    setPaymentStatus({ tone: "normal", message: "Granting dev garage..." });
    try {
      const res = await fetch("/api/dev/grant-garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dev grant failed");
      setState(data);
      setPaymentStatus({ tone: "success", message: "Dev grant complete. All cars unlocked + 2M purchased Race Cash." });
      setStatus("ready");
    } catch (err) {
      setPaymentStatus({ tone: "error", message: err instanceof Error ? err.message : "Dev grant failed" });
      setStatus("error");
    }
  }, [walletAddress]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDevStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDevStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (connected && walletAddress) void initPlayer();
      if (!connected) {
        setState(null);
        setStatus("idle");
        setTokenBalance(0);
        setPaymentStatus(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connected, initPlayer, walletAddress]);

  const focusedCar = useMemo(() => CARS.find((c) => c.id === focusedCarId) || null, [focusedCarId]);
  const focusedOwnedCar = focusedCar ? ownedCarByCatalogId.get(focusedCar.id) : undefined;

  return (
    <main className="relative min-h-screen bg-[#050509] text-white">
      {/* 3D Showroom */}
      <div className="absolute inset-0">
        <GarageShowroom
          cars={CARS}
          ownedCarIds={ownedCarIds}
          selectedCarId={selectedCarId}
          focusedCarId={focusedCarId}
          onCarClick={setFocusedCarId}
        />
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top Nav */}
        <nav className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-xl font-black tracking-[0.35em] text-fuchsia-300">RACETE</Link>
          <div className="flex items-center gap-3">
            <Link className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10" href="/race">Race</Link>
            {selectedCarId ? (
              <Link className="rounded-full bg-fuchsia-400 px-4 py-2 text-sm font-black text-black hover:bg-fuchsia-300" href="/race">Play</Link>
            ) : (
              <span className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/35">Select car to play</span>
            )}
            <a className="rounded-full bg-lime-300 px-4 py-2 text-sm font-bold text-black hover:bg-lime-200" href={publicEnv.tokenBuyUrl} target="_blank" rel="noreferrer">Buy Token</a>
            <WalletMultiButton />
          </div>
        </nav>

        {/* Stats Bar */}
        {connected && (
          <div className="mx-6 grid gap-3 md:grid-cols-4">
            <Stat label="Wallet" value={walletAddress ? shortWallet(walletAddress) : "-"} sub={walletAddress} />
            <Stat label="Pump.fun Token" value={formatNumber(tokenBalance)} sub={`Balance: ${tokenBalanceStatus}`} />
            <Stat label="Earned Race Cash" value={formatNumber(state?.player.earned_race_cash)} sub="Cashout-eligible later" />
            <Stat label="Purchased Race Cash" value={formatNumber(state?.player.purchased_race_cash)} sub="Not cashout eligible" />
          </div>
        )}

        {/* Dev Tools */}
        {connected && devToolsEnabled && isDevWallet && (
          <div className="mx-6 mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/80">Dev tools</p>
                <p className="text-sm text-white/60">Unlock all cars + add 2M Race Cash</p>
              </div>
              <button
                onClick={() => void devGrant()}
                disabled={status !== "ready"}
                className="rounded-full bg-amber-300 px-5 py-2 text-sm font-black text-black hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Dev: unlock all cars + add Race Cash
              </button>
            </div>
          </div>
        )}

        {/* Payment Status */}
        {paymentStatus && (
          <div className={`mx-6 mt-3 rounded-2xl border p-4 ${paymentStatus.tone === "error" ? "border-red-400/30 bg-red-500/10 text-red-100" : paymentStatus.tone === "success" ? "border-lime-300/30 bg-lime-300/10 text-lime-100" : "border-white/10 bg-white/[0.04] text-white/70"}`}>
            {paymentStatus.message}
          </div>
        )}

        {/* Loading / Error */}
        {status === "loading" && (
          <div className="mx-6 mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white/70">Creating/loading player profile and starter car...</div>
        )}
        {error && (
          <div className="mx-6 mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">{error}</div>
        )}

        {/* Spacer to push detail panel to bottom */}
        <div className="flex-1" />

        {/* Car Detail Panel */}
        {focusedCar && (
          <div className="mx-6 mb-6 rounded-[2rem] border border-white/15 bg-black/80 backdrop-blur-xl p-6">
            <div className="flex flex-col gap-6 lg:flex-row">
              {/* Car Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black">{focusedCar.name}</h2>
                    <p className="text-sm text-white/55">Class {focusedCar.class} · PR {focusedOwnedCar?.power_rating || focusedCar.basePowerRating}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedCarId === focusedCar.id ? "bg-lime-300 text-black" : ownedCarIds.has(focusedCar.id) ? "bg-fuchsia-300 text-black" : focusedCar.isStarter ? "bg-white/10 text-white/70" : "bg-white/10 text-white/70"}`}>
                    {selectedCarId === focusedCar.id ? "Selected" : ownedCarIds.has(focusedCar.id) ? "Owned" : focusedCar.isStarter ? "Starter" : "Locked"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-white/65">{focusedCar.vibe}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/70">
                  <span>Race Cash: {formatNumber(focusedCar.priceRaceCash)}</span>
                  <span>Token: {formatNumber(focusedCar.priceToken)}</span>
                </div>
                {devToolsEnabled && (
                  <p className="mt-2 text-xs text-amber-200/60">ID: {focusedCar.id} · {focusedCar.modelUrl || "fallback"}</p>
                )}

                {/* Actions */}
                <div className="mt-5 flex gap-2">
                  {ownedCarIds.has(focusedCar.id) ? (
                    <button
                      onClick={() => void selectCar(focusedCar.id)}
                      disabled={selectedCarId === focusedCar.id || activeCarId !== null || status !== "ready"}
                      className="rounded-full bg-lime-300 px-5 py-2 text-sm font-black text-black hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {activeCarId === focusedCar.id ? "Selecting..." : selectedCarId === focusedCar.id ? "Active car" : "Select car"}
                    </button>
                  ) : (
                    <button
                      onClick={() => void buyCar(focusedCar.id)}
                      disabled={activeCarId !== null || status !== "ready" || (!focusedCar.isStarter && totalRaceCash < focusedCar.priceRaceCash) || (!publicEnv.mockTokenMode && focusedCar.priceToken > 0 && tokenBalance < focusedCar.priceToken) || focusedCar.isStarter}
                      className="rounded-full bg-fuchsia-400 px-5 py-2 text-sm font-black text-black hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {activeCarId === focusedCar.id ? "Buying..." : focusedCar.priceToken > 0 ? "Buy with Race Cash + token" : "Buy with Race Cash"}
                    </button>
                  )}
                  {selectedCarId === focusedCar.id && (
                    <Link href="/race" className="rounded-full bg-fuchsia-400 px-5 py-2 text-sm font-black text-black hover:bg-fuchsia-300">Play</Link>
                  )}
                </div>
              </div>

              {/* Upgrades */}
              {focusedOwnedCar && (
                <div className="flex-1 border-t border-white/10 pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-lime-200/80">Upgrades</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {UPGRADE_TYPES.map((upgradeType) => {
                      const level = Number(focusedOwnedCar[`${upgradeType}_level` as keyof typeof focusedOwnedCar] || 1);
                      const price = getUpgradePrice(level);
                      const upgradeKey = `${focusedOwnedCar.id}:${upgradeType}`;
                      const upgradeBusy = activeUpgradeKey === upgradeKey;
                      const insufficientUpgradeRaceCash = Boolean(price && totalRaceCash < price.raceCash);
                      const insufficientUpgradeToken = Boolean(price && !publicEnv.mockTokenMode && price.token > 0 && tokenBalance < price.token);
                      return (
                        <div key={upgradeType} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold capitalize">{upgradeType}</span>
                            <span className="text-xs text-white/60">Lv {level}/{MAX_UPGRADE_LEVEL}</span>
                          </div>
                          {price ? (
                            <>
                              <p className="mt-1 text-xs text-white/55">Next: {formatNumber(price.raceCash)} RC{price.token > 0 ? ` + ${formatNumber(price.token)} TKN` : ""}</p>
                              <button
                                onClick={() => void upgradeCar(focusedOwnedCar.id, upgradeType)}
                                disabled={activeUpgradeKey !== null || status !== "ready" || insufficientUpgradeRaceCash || insufficientUpgradeToken}
                                className="mt-2 w-full rounded-full border border-lime-300/40 px-3 py-1.5 text-xs font-black text-lime-100 hover:bg-lime-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {upgradeBusy ? "Upgrading..." : price.token > 0 ? "Upgrade with RC + TKN" : "Upgrade with RC"}
                              </button>
                            </>
                          ) : (
                            <p className="mt-1 text-xs text-lime-200">Max level reached.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Race Cash Shop */}
        {connected && (
          <div className="mx-6 mb-6 rounded-[2rem] border border-lime-300/20 bg-lime-300/[0.04] p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-lime-300">Race Cash shop</p>
                <h2 className="mt-2 text-2xl font-black">Buy Race Cash with token</h2>
                <p className="mt-2 text-sm text-white/60">Purchased Race Cash is tracked separately and is not eligible for future cashout.</p>
              </div>
              <button onClick={() => void refreshTokenBalance()} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10">Refresh token balance</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {RACE_CASH_PACKS.map((pack) => (
                <article key={pack.id} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                  <h3 className="text-xl font-black">{pack.name}</h3>
                  <p className="mt-2 text-sm text-white/55">{pack.description}</p>
                  <div className="mt-4 space-y-1 text-sm text-white/75">
                    <p>Race Cash: <span className="font-bold text-lime-300">{formatNumber(pack.raceCashAmount)}</span></p>
                    <p>Token cost: <span className="font-bold text-fuchsia-200">{formatNumber(pack.tokenAmount)}</span></p>
                  </div>
                  <button
                    onClick={() => void buyRaceCashPack(pack)}
                    disabled={activePackId !== null || status !== "ready"}
                    className="mt-5 w-full rounded-full bg-fuchsia-400 px-4 py-2 text-sm font-black text-black hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {activePackId === pack.id ? "Processing..." : "Buy with token"}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-sm p-4">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-200/80">{label}</p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-white/45">{sub}</p>}
    </div>
  );
}
