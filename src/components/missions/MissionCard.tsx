"use client";

import type { ObjectiveState } from "@/config/objectives";

type MissionCardProps = {
  state: ObjectiveState;
  onClaim: (objectiveId: string) => void;
  claiming: boolean;
  walletAddress: string;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-lime-300 border-lime-300/30 bg-lime-300/[0.06]",
  medium: "text-amber-300 border-amber-300/30 bg-amber-300/[0.06]",
  hard: "text-orange-400 border-orange-400/30 bg-orange-400/[0.06]",
  elite: "text-fuchsia-400 border-fuchsia-400/30 bg-fuchsia-400/[0.06]",
};

const STATUS_LABELS: Record<string, string> = {
  locked: "Locked",
  in_progress: "In Progress",
  completed: "Claimable",
  claimed: "Claimed",
};

const STATUS_COLORS: Record<string, string> = {
  locked: "text-white/30 border-white/10 bg-white/[0.02]",
  in_progress: "text-cyan-300/80 border-cyan-300/20 bg-cyan-300/[0.04]",
  completed: "text-lime-300 border-lime-300/40 bg-lime-300/[0.08]",
  claimed: "text-white/50 border-white/10 bg-white/[0.03]",
};

export function MissionCard({
  state,
  onClaim,
  claiming,
  walletAddress,
}: MissionCardProps) {
  if (!walletAddress) return null;

  const { objective, status, progress, target, rewardAmount } = state;
  const isCompleted = status === "completed";
  const isClaimed = status === "claimed";
  const isLocked = status === "locked";
  const isInProgress = status === "in_progress";

  const percent = target > 0 ? Math.min(100, Math.max(0, (progress / target) * 100)) : 0;
  const diffColor = DIFFICULTY_COLORS[objective.difficulty] || DIFFICULTY_COLORS.medium;
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.locked;

  return (
    <article
      className={`rounded-2xl border p-5 transition-colors ${
        isCompleted
          ? "border-lime-300/40 bg-lime-300/[0.06] shadow-lg shadow-lime-300/5"
          : isClaimed
            ? "border-white/8 bg-white/[0.02]"
            : "border-white/10 bg-white/[0.04] hover:border-white/20"
      }`}
    >
      {/* Header: title + difficulty + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className={`text-lg font-black truncate ${
              isClaimed ? "text-white/40" : "text-white"
            }`}
          >
            {objective.title}
          </h3>
          <p className="mt-0.5 text-sm text-white/55">{objective.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${diffColor}`}
          >
            {objective.difficulty}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusColor}`}
          >
            {STATUS_LABELS[status] || status}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 text-xs text-white/50">
          <span>
            Progress: {progress} / {target}
          </span>
          <span>{Math.round(percent)}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCompleted || isClaimed
                ? "bg-lime-400"
                : isInProgress
                  ? "bg-cyan-400"
                  : "bg-white/15"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Reward + action */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-lime-200">
          +{rewardAmount} RC
        </span>

        {isCompleted && (
          <button
            onClick={() => onClaim(objective.id)}
            disabled={claiming}
            className="rounded-full bg-lime-300 px-5 py-2 text-sm font-black text-black hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] transition-all"
          >
            {claiming ? "Claiming..." : "Claim"}
          </button>
        )}

        {isClaimed && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-bold text-white/45">
            ✓ Claimed
          </span>
        )}

        {isLocked && (
          <span className="text-xs text-white/35 italic pr-2">
            Complete a race to unlock
          </span>
        )}
      </div>
    </article>
  );
}
