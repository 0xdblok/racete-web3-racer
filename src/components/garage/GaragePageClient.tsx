"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CARS, type CarConfig } from "@/config/cars";
import { RACE_CASH_PACKS, type RaceCashPack } from "@/config/economy";
import {
  getUpgradePrice,
  calculatePowerRating,
  UPGRADE_TYPES,
  MAX_UPGRADE_LEVEL,
  type UpgradeType,
} from "@/config/upgrades";
import { publicEnv } from "@/lib/env";
import { formatNumber, shortWallet } from "@/lib/format";
import type { PlayerCar, PlayerInitResponse } from "@/types/game";
import {
  GarageShowroom3D,
  type ShowroomCarClick,
} from "@/components/garage/GarageShowroom3D";

type Status = "idle" | "loading" | "ready" | "error";
type PaymentStatus = {
  tone: "normal" | "error" | "success";
  message: string;
} | null;

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
  return (
    BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) +
    BigInt(normalizedFraction || "0")
  );
}

// ── Stat bar display helper ────────────────────────────────────────

function StatBar({ label, value, max = 100, accent }: { label: string; value: number; max?: number; accent?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const barColor = accent || "bg-lime-400";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-white/50 capitalize">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-white/70 tabular-nums">{value}</span>
    </div>
  );
}

// ── Recommended next action heuristic ──────────────────────────────

function getRecommendedAction(
  state: PlayerInitResponse | null,
  totalRC: number,
  ownedIds: Set<string>,
  selectedCarId: string | null,
  focusedCatalogCar: CarConfig | null,
): string | null {
  if (!state) return null;

  const ownedCount = state.ownedCars.length;
  const totalCars = CARS.length;

  // No cars owned at all (shouldn't happen → starter is free)
  if (ownedCount === 0) return "Select the free starter car to begin racing.";

  // Only starter car owned → suggest buying first car
  if (ownedCount === 1) {
    const cheapest = CARS
      .filter((c) => !c.isStarter && c.priceRaceCash > 0)
      .sort((a, b) => a.priceRaceCash - b.priceRaceCash)[0];
    if (cheapest) {
      const needed = cheapest.priceRaceCash - totalRC;
      if (needed <= 0) return `You can afford the ${cheapest.name}! Buy it to unlock Class ${cheapest.class}.`;
      return `Earn ${formatNumber(needed)} more RC to buy ${cheapest.name} (Class ${cheapest.class}).`;
    }
  }

  // Selected car available → suggest racing
  if (selectedCarId && totalRC < 5000 && ownedCount < 3) {
    return "Race City Loop to earn Race Cash and unlock new cars.";
  }

  // Has enough for next car
  const nextAffordable = CARS
    .filter((c) => !ownedIds.has(c.id) && !c.isStarter && c.priceRaceCash > 0 && c.priceRaceCash <= totalRC)
    .sort((a, b) => a.priceRaceCash - b.priceRaceCash)[0];
  if (nextAffordable && !focusedCatalogCar) {
    return `${nextAffordable.name} is affordable! Click it in the showroom to buy.`;
  }

  // Upgrade suggestion for focused car
  if (focusedCatalogCar && ownedIds.has(focusedCatalogCar.id)) {
    const ownedCar = state.ownedCars.find((c) => c.car_id === focusedCatalogCar.id);
    if (ownedCar) {
      for (const ut of UPGRADE_TYPES) {
        const level = Number(ownedCar[`${ut}_level` as keyof typeof ownedCar] ?? 1);
        const price = getUpgradePrice(level);
        if (price && price.raceCash <= totalRC) {
          return `Upgrade ${focusedCatalogCar.name}'s ${ut} to Lv${price.nextLevel} for ${formatNumber(price.raceCash)} RC.`;
        }
      }
    }
  }

  // Check for unclaimed missions
  if (ownedCount > 0 && totalRC > 0) {
    return "Check Missions for claimable Race Cash rewards.";
  }

  return "Race to earn RC, complete missions, and climb the leaderboard.";
}

// ── Main Component ─────────────────────────────────────────────────

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
  const [devStatus, setDevStatus] = useState<{
    devToolsEnabled: boolean;
    devWalletAddresses: string[];
  } | null>(null);
  const [focusedCarId, setFocusedCarId] = useState<string | null>(null);
  const [focusedCarClick, setFocusedCarClick] =
    useState<ShowroomCarClick | null>(null);

  const walletAddress = publicKey?.toBase58() || "";
  const ownedCarIds = useMemo(
    () => new Set(state?.ownedCars.map((car) => car.car_id) || []),
    [state],
  );
  const ownedCarByCatalogId = useMemo(
    () =>
      new Map(
        (state?.ownedCars || []).map((car) => [car.car_id, car]),
      ),
    [state],
  );
  const selectedCarId = state?.selectedCar?.car_id || null;
  const earnedRC = Number(state?.player.earned_race_cash || 0);
  const purchasedRC = Number(state?.player.purchased_race_cash || 0);
  const totalRaceCash = earnedRC + purchasedRC;

  const devToolsEnabled = Boolean(devStatus?.devToolsEnabled);
  const isDevWallet = walletAddress
    ? (devStatus?.devWalletAddresses || []).includes(walletAddress)
    : false;

  const focusedCatalogCar = useMemo(
    () => CARS.find((c) => c.id === focusedCarId) || null,
    [focusedCarId],
  );

  const recommendedAction = useMemo(
    () =>
      getRecommendedAction(
        state,
        totalRaceCash,
        ownedCarIds,
        selectedCarId,
        focusedCatalogCar,
      ),
    [state, totalRaceCash, ownedCarIds, selectedCarId, focusedCatalogCar],
  );

  const refreshTokenBalance = useCallback(async () => {
    if (!publicKey || !publicEnv.tokenMint) {
      setTokenBalance(0);
      setTokenBalanceStatus(
        publicEnv.tokenMint ? "idle" : "missing token mint",
      );
      return;
    }
    setTokenBalanceStatus("loading");
    try {
      const mint = new PublicKey(publicEnv.tokenMint);
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      const account = await connection
        .getTokenAccountBalance(ata)
        .catch(() => null);
      setTokenBalance(account?.value.uiAmount || 0);
      setTokenBalanceStatus("ready");
    } catch (err) {
      setTokenBalance(0);
      setTokenBalanceStatus(
        err instanceof Error ? err.message : "token balance failed",
      );
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
      setError(
        err instanceof Error ? err.message : "Player init failed",
      );
      setStatus("error");
    }
  }, [refreshTokenBalance, walletAddress]);

  const buyRaceCashPack = useCallback(
    async (pack: RaceCashPack) => {
      if (!publicKey || !walletAddress) return;
      if (
        !publicEnv.mockTokenMode &&
        (!publicEnv.tokenMint || !publicEnv.treasuryWallet)
      ) {
        setPaymentStatus({
          tone: "error",
          message: "Token mint or treasury wallet is not configured.",
        });
        return;
      }
      if (!publicEnv.mockTokenMode && tokenBalance < pack.tokenAmount) {
        setPaymentStatus({
          tone: "error",
          message: `Not enough token balance for ${pack.name}.`,
        });
        return;
      }
      setActivePackId(pack.id);
      setPaymentStatus({
        tone: "normal",
        message: `Creating payment intent for ${pack.name}...`,
      });
      try {
        const intentRes = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            actionType: "buy_race_cash",
            itemId: pack.id,
          }),
        });
        const intent = (await intentRes.json()) as CreateIntentResponse & {
          error?: string;
        };
        if (!intentRes.ok)
          throw new Error(intent.error || "Create payment intent failed");

        if (publicEnv.mockTokenMode) {
          setPaymentStatus({
            tone: "normal",
            message:
              "Dev mock payment mode: confirming without wallet transaction...",
          });
          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentIntentId: intent.paymentIntentId,
              mockConfirmation: {
                type: "RACETE_MOCK_TOKEN_PAYMENT",
                walletAddress,
              },
            }),
          });
          const confirmation = await confirmRes.json();
          if (!confirmRes.ok)
            throw new Error(
              confirmation.error || "Mock payment verification failed",
            );
          setPaymentStatus({
            tone: "success",
            message: `Dev mock payment confirmed. Added ${formatNumber(intent.raceCashAmount)} purchased Race Cash.`,
          });
          await initPlayer();
          return;
        }

        setPaymentStatus({
          tone: "normal",
          message: "Open your wallet and approve the SPL token transfer...",
        });
        const mint = new PublicKey(intent.tokenMint);
        const treasury = new PublicKey(intent.treasuryWallet);
        const sourceAta = getAssociatedTokenAddressSync(mint, publicKey);
        const treasuryAta = getAssociatedTokenAddressSync(mint, treasury);
        const rawAmount = tokenAmountToRaw(
          intent.tokenAmount,
          publicEnv.tokenDecimals,
        );
        const transaction = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(
            publicKey,
            treasuryAta,
            treasury,
            mint,
          ),
          createTransferCheckedInstruction(
            sourceAta,
            mint,
            treasuryAta,
            publicKey,
            rawAmount,
            publicEnv.tokenDecimals,
          ),
        );
        const signature = await sendTransaction(transaction, connection);
        setPaymentStatus({
          tone: "normal",
          message: "Transaction sent. Waiting for confirmation...",
        });
        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          "confirmed",
        );
        setPaymentStatus({
          tone: "normal",
          message: "Verifying payment on backend...",
        });
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: intent.paymentIntentId,
            signature,
          }),
        });
        const confirmation = await confirmRes.json();
        if (!confirmRes.ok)
          throw new Error(
            confirmation.error || "Payment verification failed",
          );
        setPaymentStatus({
          tone: "success",
          message: `${intent.packName} confirmed. Added ${formatNumber(intent.raceCashAmount)} purchased Race Cash.`,
        });
        await initPlayer();
      } catch (err) {
        setPaymentStatus({
          tone: "error",
          message: err instanceof Error ? err.message : "Payment failed",
        });
      } finally {
        setActivePackId(null);
      }
    },
    [
      connection,
      initPlayer,
      publicKey,
      sendTransaction,
      tokenBalance,
      walletAddress,
    ],
  );

  const buyCar = useCallback(
    async (carId: string) => {
      if (!publicKey || !walletAddress) return;
      const car = CARS.find((item) => item.id === carId);
      if (!car) return;
      setActiveCarId(car.id);
      setPaymentStatus({
        tone: "normal",
        message: `Buying ${car.name}...`,
      });
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
          setPaymentStatus({
            tone: "success",
            message: `${car.name} unlocked!`,
          });
          return;
        }
        if (
          !publicEnv.mockTokenMode &&
          (!publicEnv.tokenMint || !publicEnv.treasuryWallet)
        ) {
          throw new Error(
            "Token mint or treasury wallet is not configured.",
          );
        }
        if (!publicEnv.mockTokenMode && tokenBalance < car.priceToken) {
          throw new Error(
            `Not enough token balance for ${car.name}.`,
          );
        }
        const intentRes = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            actionType: "buy_car",
            carId: car.id,
          }),
        });
        const intent = (await intentRes.json()) as CreateIntentResponse & {
          error?: string;
        };
        if (!intentRes.ok)
          throw new Error(
            intent.error || "Create car payment intent failed",
          );

        if (publicEnv.mockTokenMode) {
          setPaymentStatus({
            tone: "normal",
            message:
              "Dev mock payment mode: confirming premium car without wallet transaction...",
          });
          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentIntentId: intent.paymentIntentId,
              mockConfirmation: {
                type: "RACETE_MOCK_TOKEN_PAYMENT",
                walletAddress,
              },
            }),
          });
          const confirmation = await confirmRes.json();
          if (!confirmRes.ok)
            throw new Error(
              confirmation.error || "Mock premium car payment failed",
            );
          setState({
            player: confirmation.player,
            ownedCars: confirmation.ownedCars,
            selectedCar: confirmation.selectedCar,
          });
          setPaymentStatus({
            tone: "success",
            message: `${car.name} unlocked!`,
          });
          return;
        }

        setPaymentStatus({
          tone: "normal",
          message: `Open your wallet to approve ${car.name} token payment...`,
        });
        const mint = new PublicKey(intent.tokenMint);
        const treasury = new PublicKey(intent.treasuryWallet);
        const sourceAta = getAssociatedTokenAddressSync(mint, publicKey);
        const treasuryAta = getAssociatedTokenAddressSync(mint, treasury);
        const rawAmount = tokenAmountToRaw(
          intent.tokenAmount,
          publicEnv.tokenDecimals,
        );
        const transaction = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(
            publicKey,
            treasuryAta,
            treasury,
            mint,
          ),
          createTransferCheckedInstruction(
            sourceAta,
            mint,
            treasuryAta,
            publicKey,
            rawAmount,
            publicEnv.tokenDecimals,
          ),
        );
        const signature = await sendTransaction(transaction, connection);
        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          "confirmed",
        );
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: intent.paymentIntentId,
            signature,
          }),
        });
        const confirmation = await confirmRes.json();
        if (!confirmRes.ok)
          throw new Error(
            confirmation.error || "Premium car payment failed",
          );
        setState({
          player: confirmation.player,
          ownedCars: confirmation.ownedCars,
          selectedCar: confirmation.selectedCar,
        });
        setPaymentStatus({
          tone: "success",
          message: `${car.name} unlocked!`,
        });
        await refreshTokenBalance();
      } catch (err) {
        setPaymentStatus({
          tone: "error",
          message:
            err instanceof Error ? err.message : "Car purchase failed",
        });
      } finally {
        setActiveCarId(null);
      }
    },
    [
      connection,
      publicKey,
      refreshTokenBalance,
      sendTransaction,
      tokenBalance,
      walletAddress,
    ],
  );

  const selectCar = useCallback(
    async (carId: string) => {
      if (!walletAddress) return;
      setActiveCarId(carId);
      setPaymentStatus({
        tone: "normal",
        message: "Selecting car...",
      });
      try {
        const res = await fetch("/api/cars/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, carId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Car select failed");
        setState(data);
        setPaymentStatus({
          tone: "success",
          message: "Car selected for racing.",
        });
      } catch (err) {
        setPaymentStatus({
          tone: "error",
          message:
            err instanceof Error ? err.message : "Car select failed",
        });
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
      const ownedCar = state?.ownedCars.find(
        (car) => car.id === playerCarId,
      );
      const currentLevel = Number(
        ownedCar?.[
          `${upgradeType}_level` as keyof typeof ownedCar
        ] || 1,
      );
      const price = getUpgradePrice(currentLevel);
      if (!price) return;
      setActiveUpgradeKey(key);
      setPaymentStatus({
        tone: "normal",
        message: `Upgrading ${upgradeType} to level ${price.nextLevel}...`,
      });
      try {
        if (price.token <= 0) {
          const res = await fetch("/api/cars/upgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress,
              playerCarId,
              upgradeType,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upgrade failed");
          setState(data);
          setPaymentStatus({
            tone: "success",
            message: `${upgradeType} upgraded to Lv${price.nextLevel}! PR +${calculatePRGain(ownedCar, upgradeType, currentLevel)}`,
          });
          return;
        }
        if (
          !publicEnv.mockTokenMode &&
          (!publicEnv.tokenMint || !publicEnv.treasuryWallet)
        ) {
          throw new Error(
            "Token mint or treasury wallet is not configured.",
          );
        }
        if (
          !publicEnv.mockTokenMode &&
          tokenBalance < price.token
        ) {
          throw new Error(
            `Not enough token balance for ${upgradeType} upgrade.`,
          );
        }
        const intentRes = await fetch(
          "/api/payments/create-intent",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress,
              actionType: "upgrade_car",
              playerCarId,
              upgradeType,
            }),
          },
        );
        const intent = (await intentRes.json()) as CreateIntentResponse & {
          error?: string;
        };
        if (!intentRes.ok)
          throw new Error(
            intent.error || "Create upgrade payment intent failed",
          );

        if (publicEnv.mockTokenMode) {
          setPaymentStatus({
            tone: "normal",
            message:
              "Dev mock payment mode: confirming premium upgrade without wallet transaction...",
          });
          const confirmRes = await fetch("/api/payments/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentIntentId: intent.paymentIntentId,
              mockConfirmation: {
                type: "RACETE_MOCK_TOKEN_PAYMENT",
                walletAddress,
              },
            }),
          });
          const confirmation = await confirmRes.json();
          if (!confirmRes.ok)
            throw new Error(
              confirmation.error || "Mock premium upgrade failed",
            );
          setState({
            player: confirmation.player,
            ownedCars: confirmation.ownedCars,
            selectedCar: confirmation.selectedCar,
          });
          setPaymentStatus({
            tone: "success",
            message: `${upgradeType} upgraded to Lv${price.nextLevel}!`,
          });
          return;
        }

        setPaymentStatus({
          tone: "normal",
          message: `Open your wallet to approve ${upgradeType} token payment...`,
        });
        const mint = new PublicKey(intent.tokenMint);
        const treasury = new PublicKey(intent.treasuryWallet);
        const sourceAta = getAssociatedTokenAddressSync(
          mint,
          publicKey,
        );
        const treasuryAta = getAssociatedTokenAddressSync(
          mint,
          treasury,
        );
        const rawAmount = tokenAmountToRaw(
          intent.tokenAmount,
          publicEnv.tokenDecimals,
        );
        const transaction = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(
            publicKey,
            treasuryAta,
            treasury,
            mint,
          ),
          createTransferCheckedInstruction(
            sourceAta,
            mint,
            treasuryAta,
            publicKey,
            rawAmount,
            publicEnv.tokenDecimals,
          ),
        );
        const signature = await sendTransaction(
          transaction,
          connection,
        );
        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          "confirmed",
        );
        const confirmRes = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId: intent.paymentIntentId,
            signature,
          }),
        });
        const confirmation = await confirmRes.json();
        if (!confirmRes.ok)
          throw new Error(
            confirmation.error || "Premium upgrade failed",
          );
        setState({
          player: confirmation.player,
          ownedCars: confirmation.ownedCars,
          selectedCar: confirmation.selectedCar,
        });
        setPaymentStatus({
          tone: "success",
          message: `${upgradeType} upgraded to Lv${price.nextLevel}!`,
        });
        await refreshTokenBalance();
      } catch (err) {
        setPaymentStatus({
          tone: "error",
          message:
            err instanceof Error ? err.message : "Upgrade failed",
        });
      } finally {
        setActiveUpgradeKey(null);
      }
    },
    [
      connection,
      publicKey,
      refreshTokenBalance,
      sendTransaction,
      state?.ownedCars,
      tokenBalance,
      walletAddress,
    ],
  );

  const devGrant = useCallback(async () => {
    if (!walletAddress) return;
    setStatus("loading");
    setPaymentStatus({
      tone: "normal",
      message: "Granting dev garage...",
    });
    try {
      const res = await fetch("/api/dev/grant-garage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dev grant failed");
      setState(data);
      setPaymentStatus({
        tone: "success",
        message:
          "Dev grant complete. All cars unlocked + 2M purchased Race Cash.",
      });
      setStatus("ready");
    } catch (err) {
      setPaymentStatus({
        tone: "error",
        message:
          err instanceof Error ? err.message : "Dev grant failed",
      });
      setStatus("error");
    }
  }, [walletAddress]);

  const handleShowroomCarClick = useCallback(
    (info: ShowroomCarClick) => {
      setFocusedCarId(info.car.id);
      setFocusedCarClick(info);
    },
    [],
  );

  const handleBackToOverview = useCallback(() => {
    setFocusedCarId(null);
    setFocusedCarClick(null);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusedCarId) {
        handleBackToOverview();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedCarId, handleBackToOverview]);

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

  // ── Not connected ────────────────────────────────────────────────
  if (!connected) {
    return (
      <GarageShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
            Wallet required
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            Connect wallet to view your garage.
          </h1>
          <p className="mt-3 text-white/55">
            Your cars, upgrades, and Race Cash live on your wallet.
          </p>
          <div className="mt-6 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      </GarageShell>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <GarageShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="text-white/60">
            Loading garage for {shortWallet(walletAddress)}...
          </p>
        </div>
      </GarageShell>
    );
  }

  // ── Error ────────────────────────────────────────────────────────
  if (error) {
    return (
      <GarageShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-red-200">{error}</p>
          <button
            onClick={() => void initPlayer()}
            className="mt-4 rounded-full bg-white/10 px-5 py-2 text-sm font-bold text-white hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      </GarageShell>
    );
  }

  // ── No cars ──────────────────────────────────────────────────────
  if (
    status === "ready" &&
    state &&
    state.ownedCars.length === 0
  ) {
    return (
      <GarageShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-200">
            Empty Garage
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            No cars in your garage yet.
          </h1>
          <p className="mt-3 text-white/55">
            The starter car should have been added automatically.
            Try reconnecting your wallet.
          </p>
          <button
            onClick={() => void initPlayer()}
            className="mt-4 rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black hover:bg-lime-200"
          >
            Refresh garage
          </button>
        </div>
      </GarageShell>
    );
  }

  // ── No selected car ──────────────────────────────────────────────
  if (
    status === "ready" &&
    state &&
    state.ownedCars.length > 0 &&
    !selectedCarId
  ) {
    return (
      <GarageShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-200">
            No car selected
          </p>
          <h1 className="mt-3 text-3xl font-black text-white">
            Select a car to race.
          </h1>
          <p className="mt-3 text-white/55">
            Click any owned car in the showroom, then click Select.
          </p>
        </div>
      </GarageShell>
    );
  }

  // ── Full garage UI ───────────────────────────────────────────────
  return (
    <GarageShell>
      {/* Race Cash Balance Header */}
      <div className="rounded-[2rem] border border-lime-300/20 bg-[radial-gradient(circle_at_top_left,#1a2e05,transparent_40%),#0a0a12] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300/80">
              Race Cash
            </p>
            <p className="mt-1 text-4xl font-black text-lime-200">
              {formatNumber(totalRaceCash)} RC
            </p>
            <p className="mt-1 text-xs text-white/45">
              {formatNumber(earnedRC)} earned
              {purchasedRC > 0 && ` · ${formatNumber(purchasedRC)} purchased`}
            </p>
            <p className="mt-1 text-xs text-white/35">
              Earn Race Cash by racing, beating records, and completing missions.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/race"
              className="rounded-full bg-fuchsia-400 px-5 py-2.5 text-sm font-black text-black hover:bg-fuchsia-300 transition-colors"
            >
              Race to Earn RC
            </Link>
            <Link
              href="/missions"
              className="rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-2.5 text-sm font-bold text-lime-200 hover:bg-lime-300/20 transition-colors"
            >
              Missions
            </Link>
            <Link
              href="/weekly"
              className="rounded-full border border-amber-300/30 bg-amber-300/10 px-5 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-300/20 transition-colors"
            >
              Weekly
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/70 hover:bg-white/10 transition-colors"
            >
              Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* Recommended Action */}
      {recommendedAction && (
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/60 mb-1">
            Recommended
          </p>
          <p className="text-sm text-white/70">{recommendedAction}</p>
        </div>
      )}

      {/* Stats Bar (compact) */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <MiniStat
          label="Wallet"
          value={shortWallet(walletAddress)}
        />
        <MiniStat
          label="Owned Cars"
          value={`${state?.ownedCars.length || 0} / ${CARS.length}`}
        />
        <MiniStat
          label="Selected"
          value={
            state?.selectedCar
              ? CARS.find((c) => c.id === state.selectedCar?.car_id)
                  ?.name || "—"
              : "—"
          }
        />
        <MiniStat
          label="Token"
          value={formatNumber(tokenBalance)}
        />
      </div>

      {/* Dev Tools */}
      {connected && devToolsEnabled && isDevWallet && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200/80">
                Dev tools
              </p>
              <p className="text-sm text-white/60">
                Unlock all cars + add 2M Race Cash
              </p>
            </div>
            <button
              onClick={() => void devGrant()}
              disabled={status !== "ready"}
              className="rounded-full bg-amber-300 px-5 py-2 text-sm font-black text-black hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Dev: unlock all + add RC
            </button>
          </div>
        </div>
      )}

      {/* Payment Status */}
      {paymentStatus && (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${
            paymentStatus.tone === "error"
              ? "border-red-400/30 bg-red-500/10 text-red-200 animate-pulse"
              : paymentStatus.tone === "success"
                ? "border-lime-300/30 bg-lime-300/10 text-lime-200"
                : "border-white/10 bg-white/[0.04] text-white/70"
          }`}
        >
          {paymentStatus.message}
        </div>
      )}

      {/* 3D Garage Showroom + Side Panel */}
      <section className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <GarageShowroom3D
          cars={CARS}
          ownedCarIds={ownedCarIds}
          selectedCarId={selectedCarId}
          focusedCarId={focusedCarId}
          onCarClick={handleShowroomCarClick}
          onBackToOverview={handleBackToOverview}
        />
        {/* Side Panel */}
        <div className="flex flex-col gap-4">
          {focusedCarClick ? (
            <CarDetailPanel
              info={focusedCarClick}
              ownedCar={
                focusedCarClick
                  ? ownedCarByCatalogId.get(
                      focusedCarClick.car.id,
                    )
                  : undefined
              }
              totalRaceCash={totalRaceCash}
              tokenBalance={tokenBalance}
              status={status}
              activeCarId={activeCarId}
              activeUpgradeKey={activeUpgradeKey}
              onSelect={() =>
                focusedCarClick &&
                void selectCar(focusedCarClick.car.id)
              }
              onBuy={() =>
                focusedCarClick &&
                void buyCar(focusedCarClick.car.id)
              }
              onUpgrade={(playerCarId, ut) =>
                void upgradeCar(playerCarId, ut)
              }
              onBack={handleBackToOverview}
            />
          ) : (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
              <p className="text-white/30 text-sm">
                Click a car in the showroom
              </p>
              <p className="text-white/20 text-xs mt-1">
                to view details and actions
              </p>
            </div>
          )}
          {/* Quick Select */}
          {connected && (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/40 mb-3">
                Quick Select
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto">
                {CARS.map((car) => {
                  const isSel = car.id === selectedCarId;
                  const isOwn = ownedCarIds.has(car.id);
                  return (
                    <button
                      key={car.id}
                      onClick={() =>
                        handleShowroomCarClick({
                          car,
                          isSelected: isSel,
                          isOwned: isOwn,
                        })
                      }
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                        isSel
                          ? "bg-lime-300 text-black ring-1 ring-lime-300/50"
                          : isOwn
                            ? "bg-fuchsia-300/20 text-fuchsia-200 border border-fuchsia-300/30"
                            : "bg-white/5 text-white/50 border border-white/10"
                      } hover:bg-white/15`}
                    >
                      {car.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Race Cash Shop */}
      {connected && (
        <div className="rounded-[2rem] border border-lime-300/20 bg-lime-300/[0.04] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-lime-300">
                Race Cash shop
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Buy Race Cash with token
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Purchased Race Cash is tracked separately and is not
                eligible for future cashout.
              </p>
            </div>
            <button
              onClick={() => void refreshTokenBalance()}
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Refresh token balance
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {RACE_CASH_PACKS.map((pack) => (
              <article
                key={pack.id}
                className="rounded-3xl border border-white/10 bg-black/30 p-5"
              >
                <h3 className="text-xl font-black">{pack.name}</h3>
                <p className="mt-2 text-sm text-white/55">
                  {pack.description}
                </p>
                <div className="mt-4 space-y-1 text-sm text-white/75">
                  <p>
                    Race Cash:{" "}
                    <span className="font-bold text-lime-300">
                      {formatNumber(pack.raceCashAmount)}
                    </span>
                  </p>
                  <p>
                    Token cost:{" "}
                    <span className="font-bold text-fuchsia-200">
                      {formatNumber(pack.tokenAmount)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => void buyRaceCashPack(pack)}
                  disabled={
                    activePackId !== null || status !== "ready"
                  }
                  className="mt-5 w-full rounded-full bg-fuchsia-400 px-4 py-2 text-sm font-black text-black hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {activePackId === pack.id
                    ? "Processing..."
                    : "Buy with token"}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </GarageShell>
  );
}

// ── Garage Shell (nav bar + layout) ────────────────────────────────

function GarageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#050509] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
        {/* Top Nav */}
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
              href="/race"
            >
              Race
            </Link>
            <Link
              className="rounded-full border border-lime-300/30 bg-lime-300/[0.08] px-4 py-2 text-sm font-bold text-lime-200 hover:bg-lime-300/15"
              href="/missions"
            >
              Missions
            </Link>
            <Link
              className="rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-300/15"
              href="/weekly"
            >
              Weekly
            </Link>
            <Link
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              href="/leaderboard"
            >
              Leaderboard
            </Link>
            <Link
              className="rounded-full bg-gradient-to-r from-purple-500/80 to-cyan-400/80 px-4 py-2 text-sm font-bold text-black hover:from-purple-500 hover:to-cyan-400"
              href="/race/multiplayer"
            >
              Multiplayer
            </Link>
            <a
              className="rounded-full bg-lime-300 px-4 py-2 text-sm font-bold text-black hover:bg-lime-200"
              href={publicEnv.tokenBuyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Buy Token
            </a>
            <WalletMultiButton />
          </div>
        </nav>
        {children}
      </div>
    </main>
  );
}

// ── Car Detail Panel ───────────────────────────────────────────────

type CarDetailPanelProps = {
  info: ShowroomCarClick;
  ownedCar: PlayerCar | undefined;
  totalRaceCash: number;
  tokenBalance: number;
  status: Status;
  activeCarId: string | null;
  activeUpgradeKey: string | null;
  onSelect: () => void;
  onBuy: () => void;
  onUpgrade: (playerCarId: string, upgradeType: UpgradeType) => void;
  onBack: () => void;
};

const CLASS_ACCENT: Record<string, string> = {
  D: "bg-slate-400",
  C: "bg-lime-400",
  "C+": "bg-emerald-400",
  B: "bg-cyan-400",
  "B+": "bg-sky-400",
  A: "bg-fuchsia-400",
  S: "bg-amber-400",
};

function CarDetailPanel({
  info,
  ownedCar,
  totalRaceCash,
  tokenBalance,
  status,
  activeCarId,
  activeUpgradeKey,
  onSelect,
  onBuy,
  onUpgrade,
  onBack,
}: CarDetailPanelProps) {
  const { car, isSelected, isOwned } = info;
  const busy = activeCarId === car.id;
  const currentPR = ownedCar?.power_rating ?? car.basePowerRating;
  const insufficientRC = !isOwned && totalRaceCash < car.priceRaceCash;
  const insufficientToken =
    !isOwned &&
    !publicEnv.mockTokenMode &&
    car.priceToken > 0 &&
    tokenBalance < car.priceToken;
  const classAccent = CLASS_ACCENT[car.class] || "bg-white/20";

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-16rem)]">
      {/* Back */}
      <button
        onClick={onBack}
        className="self-start rounded-full border border-white/15 px-3 py-1 text-xs text-white/60 hover:bg-white/10"
      >
        ← Showroom
      </button>

      {/* Header: name + class + PR */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black">{car.name}</h2>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black text-black ${classAccent}`}
          >
            {car.class}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-3xl font-black text-lime-200">
            PR {currentPR}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isSelected
                ? "bg-lime-300 text-black"
                : isOwned
                  ? "bg-fuchsia-300/20 text-fuchsia-200 border border-fuchsia-300/40"
                  : car.isStarter
                    ? "bg-white/10 text-white/50"
                    : "bg-white/5 text-white/40 border border-white/15"
            }`}
          >
            {isSelected
              ? "Active"
              : isOwned
                ? "Owned"
                : car.isStarter
                  ? "Free"
                  : "Locked"}
          </span>
        </div>
        {car.vibe && (
          <p className="mt-2 text-sm text-white/45">{car.vibe}</p>
        )}
      </div>

      {/* Price (if not owned) */}
      {!isOwned && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-2">
            Price
          </p>
          <div className="flex items-center gap-4">
            <span className="text-lg font-black text-lime-200">
              {formatNumber(car.priceRaceCash)} RC
            </span>
            {car.priceToken > 0 && (
              <span className="text-lg font-black text-fuchsia-200">
                +{formatNumber(car.priceToken)} TKN
              </span>
            )}
          </div>
          {insufficientRC && (
            <p className="mt-2 text-xs text-red-200/80">
              Need {formatNumber(car.priceRaceCash - totalRaceCash)}{" "}
              more RC
            </p>
          )}
          {insufficientToken && (
            <p className="mt-1 text-xs text-red-200/80">
              Need {formatNumber(car.priceToken - tokenBalance)} more
              TKN
            </p>
          )}
        </div>
      )}

      {/* Stat bars */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 mb-3">
          Stats
        </p>
        <div className="space-y-2.5">
          <StatBar
            label="Speed"
            value={car.stats.speed}
            max={100}
            accent="bg-cyan-400"
          />
          <StatBar
            label="Accel"
            value={car.stats.acceleration}
            max={100}
            accent="bg-lime-400"
          />
          <StatBar
            label="Handling"
            value={car.stats.handling}
            max={100}
            accent="bg-fuchsia-400"
          />
          <StatBar
            label="Nitro"
            value={car.stats.nitro}
            max={100}
            accent="bg-amber-400"
          />
        </div>
      </div>

      {/* Action button */}
      <div>
        {isOwned ? (
          <button
            onClick={onSelect}
            disabled={
              isSelected ||
              busy ||
              activeUpgradeKey !== null ||
              status !== "ready"
            }
            className="w-full rounded-full bg-lime-300 px-4 py-3 text-sm font-black text-black hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-45 transition-all"
          >
            {busy
              ? "Selecting..."
              : isSelected
                ? "✓ Active car"
                : "Select for racing"}
          </button>
        ) : (
          <button
            onClick={onBuy}
            disabled={
              activeCarId !== null ||
              activeUpgradeKey !== null ||
              status !== "ready" ||
              insufficientRC ||
              insufficientToken ||
              car.isStarter
            }
            className="w-full rounded-full bg-fuchsia-400 px-4 py-3 text-sm font-black text-black hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-45 transition-all"
          >
            {busy
              ? "Buying..."
              : car.priceToken > 0
                ? `Buy (${formatNumber(car.priceRaceCash)} RC + ${formatNumber(car.priceToken)} TKN)`
                : `Buy (${formatNumber(car.priceRaceCash)} RC)`}
          </button>
        )}
      </div>

      {/* Upgrades section */}
      {ownedCar && (
        <div className="border-t border-white/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-200/80 mb-3">
            Upgrades
          </p>
          <div className="space-y-3">
            {UPGRADE_TYPES.map((upgradeType) => {
              const level = Number(
                ownedCar[
                  `${upgradeType}_level` as keyof typeof ownedCar
                ] ?? 1,
              );
              const price = getUpgradePrice(level);
              const upgradeKey = `${ownedCar.id}:${upgradeType}`;
              const upgradeBusy = activeUpgradeKey === upgradeKey;
              const atMax = level >= MAX_UPGRADE_LEVEL;
              const canAfford =
                !atMax &&
                price &&
                totalRaceCash >= price.raceCash;
              const prGain = calculatePRGain(
                ownedCar,
                upgradeType,
                level,
              );

              return (
                <div
                  key={upgradeType}
                  className="rounded-xl border border-white/8 bg-black/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="capitalize text-sm font-bold text-white/80">
                        {upgradeType}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {/* Level dots */}
                        {Array.from(
                          { length: MAX_UPGRADE_LEVEL },
                          (_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i < level
                                  ? "bg-lime-400"
                                  : "bg-white/10"
                              }`}
                            />
                          ),
                        )}
                        <span className="text-[10px] text-white/40 ml-1">
                          Lv{level}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {atMax ? (
                        <span className="text-xs font-bold text-lime-200/60">
                          MAX
                        </span>
                      ) : price ? (
                        <>
                          <p className="text-xs font-bold text-white/70">
                            {formatNumber(price.raceCash)} RC
                          </p>
                          {price.token > 0 && (
                            <p className="text-[10px] text-fuchsia-200/70">
                              +{formatNumber(price.token)} TKN
                            </p>
                          )}
                          <p className="text-[10px] text-lime-200/60">
                            → PR {currentPR + prGain} (+{prGain})
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onUpgrade(ownedCar.id, upgradeType)
                    }
                    disabled={
                      atMax ||
                      activeUpgradeKey !== null ||
                      status !== "ready" ||
                      !canAfford
                    }
                    className={`mt-2 w-full rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      atMax
                        ? "bg-white/5 text-white/25 cursor-not-allowed"
                        : canAfford
                          ? "bg-lime-300/15 text-lime-200 border border-lime-300/40 hover:bg-lime-300/25"
                          : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                    }`}
                  >
                    {upgradeBusy
                      ? "Upgrading..."
                      : atMax
                        ? "Max level"
                        : canAfford
                          ? `Upgrade to Lv${price!.nextLevel}`
                          : !price
                            ? "—"
                            : `Need ${formatNumber(price.raceCash - totalRaceCash)} more RC`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PR gain calculator ─────────────────────────────────────────────

function calculatePRGain(
  ownedCar: PlayerCar | undefined,
  upgradeType: UpgradeType,
  currentLevel: number,
): number {
  if (!ownedCar) return 0;
  const current = calculatePowerRating({
    basePowerRating: CARS.find((c) => c.id === ownedCar.car_id)
      ?.basePowerRating ?? ownedCar.power_rating,
    engineLevel: ownedCar.engine_level,
    tiresLevel: ownedCar.tires_level,
    nitroLevel: ownedCar.nitro_level,
    handlingLevel: ownedCar.handling_level,
  });
  const next = calculatePowerRating({
    basePowerRating: CARS.find((c) => c.id === ownedCar.car_id)
      ?.basePowerRating ?? ownedCar.power_rating,
    engineLevel:
      upgradeType === "engine"
        ? currentLevel + 1
        : ownedCar.engine_level,
    tiresLevel:
      upgradeType === "tires"
        ? currentLevel + 1
        : ownedCar.tires_level,
    nitroLevel:
      upgradeType === "nitro"
        ? currentLevel + 1
        : ownedCar.nitro_level,
    handlingLevel:
      upgradeType === "handling"
        ? currentLevel + 1
        : ownedCar.handling_level,
  });
  return next - current;
}

// ── Mini Stat ──────────────────────────────────────────────────────

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white/80 truncate">
        {value}
      </p>
    </div>
  );
}
