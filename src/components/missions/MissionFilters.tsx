"use client";

import type { ObjectiveDifficulty } from "@/config/objectives";

export type MissionFilter =
  | "all"
  | "easy"
  | "medium"
  | "hard"
  | "elite"
  | "claimable"
  | "completed";

const FILTERS: { key: MissionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
  { key: "elite", label: "Elite" },
  { key: "claimable", label: "Claimable" },
  { key: "completed", label: "Completed" },
];

type MissionFiltersProps = {
  active: MissionFilter;
  onChange: (filter: MissionFilter) => void;
};

export function MissionFilters({ active, onChange }: MissionFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
            active === f.key
              ? "border-lime-300/40 bg-lime-300/15 text-lime-200"
              : "border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
