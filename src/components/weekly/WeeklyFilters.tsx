"use client";

const CATEGORY_LABELS: Record<string, string> = {
  best_total_time: "Best Total",
  best_first_lap: "Best 1st Lap",
  best_lap: "Best Lap",
  race_cash_earned: "RC Earned",
  missions_completed: "Missions",
  races_finished: "Races",
};

const CLASS_LABELS: Record<string, string> = {
  all: "All Classes",
  D: "Class D",
  C: "Class C",
  "C+": "Class C+",
  B: "Class B",
  "B+": "Class B+",
  A: "Class A",
  S: "Class S",
};

export function WeeklyFilters({
  category,
  carClass,
  limit,
  categories,
  classes,
  limits,
  onCategoryChange,
  onCarClassChange,
  onLimitChange,
}: {
  category: string;
  carClass: string;
  limit: number;
  categories: readonly string[];
  classes: readonly string[];
  limits: readonly number[];
  onCategoryChange: (value: string) => void;
  onCarClassChange: (value: string) => void;
  onLimitChange: (value: number) => void;
}) {
  return (
    <div className="mb-6 space-y-4">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.15em] transition-all ${
              category === cat
                ? "bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-200"
                : "border border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/70"
            }`}
          >
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {/* Class + Limit row */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex flex-wrap gap-1">
          {classes.map((cls) => (
            <button
              key={cls}
              onClick={() => onCarClassChange(cls)}
              className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] transition-all ${
                carClass === cls
                  ? "bg-lime-500/15 border border-lime-400/25 text-lime-300"
                  : "border border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/15 hover:text-white/55"
              }`}
            >
              {CLASS_LABELS[cls] || cls}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-white/10 hidden sm:block" />

        <div className="flex gap-1">
          {limits.map((l) => (
            <button
              key={l}
              onClick={() => onLimitChange(l)}
              className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] transition-all ${
                limit === l
                  ? "bg-amber-500/15 border border-amber-400/25 text-amber-300"
                  : "border border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/15 hover:text-white/55"
              }`}
            >
              Top {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
