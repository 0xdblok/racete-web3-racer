import {
  RACETE_TEST_TOKEN_MINT,
  RACETE_TOKEN_MINT,
  TOKEN_ROOM_FEE_BPS,
  TOKEN_ROOM_MAX_PLAYERS,
  TOKEN_ROOM_MIN_PLAYERS,
  TOKEN_STAKE_PRESET_CONFIGS,
  TOKEN_STAKE_ROOMS_ENABLED,
  TOKEN_STAKE_ROOMS_TEST_MODE,
  TOKEN_TREASURY_WALLET,
  TOKEN_WEEKLY_REWARD_WALLET,
  calculateTokenRoomPoolBreakdown,
} from "@/config/token-rooms";

function formatRacete(amount: number): string {
  return `${amount.toLocaleString("en-US")} RACETE`;
}

export function TokenStakeRoomsPreview() {
  const exampleStake = 10_000;
  const examplePlayers = 6;
  const examplePool = exampleStake * examplePlayers;
  const breakdown = calculateTokenRoomPoolBreakdown(examplePool);

  return (
    <section className="w-full max-w-4xl rounded-[2rem] border border-cyan-300/20 bg-cyan-300/[0.05] p-6 text-white shadow-2xl shadow-cyan-950/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
              Token Stake Rooms
            </span>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">
              Coming Soon / Test Mode
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black">SPL token stake races are disabled.</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            Token rooms are in test/spec mode. No real deposits are enabled. Free Multiplayer and Race Cash rewards stay separate.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-white/60">
          <p className="font-bold text-white">Feature flags</p>
          <p className="mt-1">Enabled: {String(TOKEN_STAKE_ROOMS_ENABLED)}</p>
          <p>Test mode: {String(TOKEN_STAKE_ROOMS_TEST_MODE)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {TOKEN_STAKE_PRESET_CONFIGS.map((preset) => (
          <div key={preset.amount} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">Stake preset</p>
            <p className="mt-1 text-lg font-black text-cyan-100">{preset.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">Pool distribution</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Creator fee" value={`${TOKEN_ROOM_FEE_BPS.creatorFeeBps / 100}%`} muted />
            <Metric label="Weekly reward pool" value={`${TOKEN_ROOM_FEE_BPS.weeklyRewardBps / 100}%`} />
            <Metric label="Treasury fee" value={`${TOKEN_ROOM_FEE_BPS.treasuryFeeBps / 100}%`} />
            <Metric label="Player payout pool" value={`${TOKEN_ROOM_FEE_BPS.playerPayoutBps / 100}%`} highlight />
          </div>
          <p className="mt-4 text-xs text-white/45">
            Example: {examplePlayers} players × {formatRacete(exampleStake)} = {formatRacete(examplePool)} pool → {formatRacete(breakdown.playerPayoutPoolAmount)} player payout pool.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">Foundation config</p>
          <dl className="mt-4 space-y-3 text-xs">
            <TokenConfigRow label="Players" value={`${TOKEN_ROOM_MIN_PLAYERS}-${TOKEN_ROOM_MAX_PLAYERS}`} />
            <TokenConfigRow label="Test token mint" value={RACETE_TEST_TOKEN_MINT} />
            <TokenConfigRow label="Production mint" value={RACETE_TOKEN_MINT} />
            <TokenConfigRow label="Treasury wallet" value={TOKEN_TREASURY_WALLET} />
            <TokenConfigRow label="Weekly wallet" value={TOKEN_WEEKLY_REWARD_WALLET} />
          </dl>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100/80">
        <strong className="text-amber-200">Disabled safety state:</strong> Create Token Room, Join Token Room, and Deposit actions are intentionally unavailable in Phase A.
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button disabled className="cursor-not-allowed rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white/35">
          Create Token Room
        </button>
        <button disabled className="cursor-not-allowed rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white/35">
          Join Token Room
        </button>
        <button disabled className="cursor-not-allowed rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white/35">
          Deposit
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value, highlight = false, muted = false }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className={`mt-1 text-xl font-black ${highlight ? "text-lime-300" : muted ? "text-white/45" : "text-cyan-200"}`}>{value}</p>
    </div>
  );
}

function TokenConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-white/35">{label}</dt>
      <dd className="mt-1 break-all font-mono text-white/70">{value}</dd>
    </div>
  );
}
