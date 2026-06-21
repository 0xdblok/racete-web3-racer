"use client";

type RaceCountdownProps = {
  countdown: number;
  phase: "countdown" | "go";
};

export function RaceCountdown({ countdown, phase }: RaceCountdownProps) {
  const isGo = phase === "go";
  const label = isGo ? "GO" : countdown.toString();
  const sub = isGo ? "Launch" : "Get ready";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px]">
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-[0.5em] text-lime-300 drop-shadow-[0_0_12px_rgba(190,242,100,0.8)]">
          {sub}
        </p>
        <h1 className="mt-2 text-[9rem] font-black leading-none text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.6)] tabular-nums">
          {label}
        </h1>
      </div>
    </div>
  );
}
