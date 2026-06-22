# Racete Economy: Race Cash Rewards and Token Stake Rooms

## Currency separation

- **Race Cash (RC)** is off-chain in-game currency stored in Supabase.
- **$RACETE / Pump.fun SPL token** is the on-chain token used later for token stake matchmaking and premium actions.
- Race Cash rewards are never on-chain token payouts.
- Token stake pot payouts are separate from Race Cash rewards.

## Mode behavior

### Solo Race — Performance-Based Rewards

No on-chain token stake. Off-chain Race Cash only. Rewards scale with driver performance — higher skill yields higher earnings. No daily cap; players can grind freely.

V2 formula (configurable in `src/config/rewards.ts`):
- Finish: `+40 RC`
- Target time (total race under track target): `+20 RC`
- New personal best total time: `+75 RC`
- New personal best first lap: `+60 RC`
- New personal best lap: `+50 RC`
- Clean race (no wrong-way): `+25 RC`
- No reset: `+25 RC`
- Perfect route (no wrong-way hint): `+20 RC`
- Max solo reward: `320 RC`

**Target times** are per-track, per-car-class (`city-loop` D through S classes configurable).

**Personal records** tracked in `race_records` table (unique per wallet + track + car_class):
- `best_total_time_ms`
- `best_first_lap_ms`
- `best_lap_ms`
- `total_races_finished`
- `total_race_cash_earned`

Personal best bonuses only trigger when the player beats a previous record. First-time entries do not award personal best bonuses.

### Free Multiplayer Race

- No on-chain token stake.
- Every player earns off-chain Race Cash based on server-verified placement.
- V1 6-player placement rewards:
  - 1st: `+300 RC`
  - 2nd: `+220 RC`
  - 3rd: `+160 RC`
  - 4th: `+100 RC`
  - 5th: `+60 RC`
  - 6th: `+40 RC`

### Token Stake Rooms — future, disabled/test mode in V1 UI

Token mint config for Token Stake Rooms docs:

```env
# Temporary dev/test token mint only. Do not use as final production Pump.fun token.
RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump

# Final production Pump.fun token mint. Still pending and must remain a placeholder until provided.
RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT
```

Implementation rule:

- `RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump` is a temporary dev/test token mint only.
- It is not the final production Pump.fun token.
- Dev/test token room flows should use `RACETE_TEST_TOKEN_MINT`.
- Production/mainnet flows must use `RACETE_TOKEN_MINT` only after the final Pump.fun mint is provided.
- `RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT` remains the production placeholder.

- Players will deposit RACETE into a token stake pot later.
- Top valid finishers receive token payout from the player payout pool.
- Token stake rooms are multiplayer-only and currently **coming soon**: no real SPL transfer, escrow, payout, or treasury signer is implemented here.
- V1 Token Stake Rooms should not pay Race Cash unless explicitly redesigned later; token accounting must stay separate from current Race Cash systems.

Final V1 pool distribution preview:

- Total pool: `stakeAmount × numberOfPlayers`
- Creator fee: `0%`
- Weekly token stake reward pool: `15%`
- Platform / treasury fee: `5%`
- Player payout pool: `80%`

Example stake tier preview:

- Stake: `10,000 RACETE × 6 players = 60,000 RACETE pool`
- Weekly token stake reward pool: `15% = 9,000 RACETE`
- Platform / treasury fee: `5% = 3,000 RACETE`
- Player payout pool: `80% = 48,000 RACETE`
- Creator fee: `0% = 0 RACETE`

If 3+ valid finishers:

- 1st: `65% of player payout pool = 31,200 RACETE`
- 2nd: `25% of player payout pool = 12,000 RACETE`
- 3rd: `10% of player payout pool = 4,800 RACETE`

Weekly token stake rewards are tracked with a frozen 7-day snapshot and are admin-reviewed/manual-payout only in V1; no automatic weekly token payouts.

## Race result tracking

The following fields are captured per race and passed to the reward API:

- `totalTimeMs`, `bestLapMs`, `firstLapMs`
- `lapsCompleted`, `checkpointsCompleted`
- `wrongWayTriggered` (boolean)
- `resetCount` (number)
- `carClass` (for per-class target times)
- `clientRaceId` (unique per race session, prevents duplicate claims)

## Server-authoritative requirements

- Multiplayer Race Cash placement rewards must be awarded from server-verified race results.
- Future on-chain pot payouts must happen only after server-authoritative race finalization.
- The client must never be trusted to claim multiplayer placement rewards or on-chain token payouts directly.
- Current `/api/race/reward` intentionally rejects client-only multiplayer claims until server authority is wired.

## Weekly leaderboard architecture (future)

Future leaderboards will track career stats from `race_records`:

- Best total race time per track
- Best first lap per track
- Best lap per track
- Most races finished
- Total Race Cash earned

Weekly leaderboard prizes remain Race Cash-only until token stake rooms are explicitly implemented.

Token Stake Rooms V1 will track a separate weekly token stake reward pool funded by the 15% weekly allocation from every token stake room. Weekly token rewards are admin-reviewed/manual-payout only in V1; no automatic weekly token payout is allowed.

Weekly token rewards should be distributed from a frozen weekly snapshot:

- Snapshot cadence: every 7 days.
- Recommended window: Monday 00:00 UTC → next Monday 00:00 UTC.
- Example week id: `2026-W26`.
- Snapshot freezes the token-room leaderboard, weekly pool amount, token room count, token volume, eligibility flags, DQ/suspicious counts, and suggested payouts.
- Admin manually reviews the snapshot, sends RACETE from `TOKEN_WEEKLY_REWARD_WALLET`, and records payout signatures.
- Snapshot data should be immutable after final review except admin notes and manual payout transaction signatures.

Weekly snapshot header captures:

- `weekId`, `weekStart`, `weekEnd`, `snapshotCreatedAt`
- `tokenMint` (test mint in dev, production mint after final Pump.fun mint is provided)
- `weeklyRewardWalletAddress`, `treasuryWalletAddress`
- `totalWeeklyTokenStakeRewardPoolAmount` — all 15% weekly pool allocations from settled token rooms in `[weekStart, weekEnd)`
- `totalTokenRoomVolume`, `totalTokenRoomsCount`
- `leaderboardCategory`, `rankingBasis`
- `snapshotStatus`: `pending_review` → `reviewed` → `paid` (or `disputed`)

Snapshot entries track per-wallet:

- `walletAddress`, `rank`
- Performance: `totalTokenRoomWins`, `totalTokenRoomRaces`, `validFinishes`, `dnfCount`, `dqCount`, `suspiciousEventCount`
- Financial: `totalStakeVolume`, `grossTokenWinnings`, `totalTokenStaked`, `netTokenPnl`
- Speed: `bestTimeMs` (tie-breaker), `winRate`
- Review: `payoutEligible`, `adminReviewStatus` (`unreviewed` | `cleared` | `flagged` | `blocked`), `suggestedPayoutAmount`
- Payout: `manualPayoutStatus` (`unpaid` | `paid` | `blocked` | `under_review`), `manualPayoutSignature`, `adminNotes`

Primary ranking: composite `token_room_weekly_composite` (wins → net PnL → finish rate → DQ count → best time). Alternative categories include `most_wins`, `highest_pnl`, `best_win_rate`, `most_volume`, `best_race_time`, `risk_adjusted`.

Manual payout process:

1. Week closes Monday 00:00 UTC.
2. Admin triggers snapshot creation (or scheduled automation creates pending snapshot).
3. Snapshot freezes leaderboard + pool totals from settled token rooms.
4. Admin reviews: reviews DQ/suspicious flags, marks each entry `cleared`, `flagged`, or `blocked`.
5. Admin sets `payoutEligible` and `suggestedPayoutAmount` (advisory; admin may adjust).
6. Admin manually sends RACETE from `TOKEN_WEEKLY_REWARD_WALLET` per approved entry.
7. Admin records `manualPayoutSignature` via `PATCH /api/admin/weekly-token-snapshots/:weekId/record-payout`.
8. Snapshot transitions to `paid` when all eligible entries are paid.

## Flexible objectives framework (future)

The reward system is structured to support achievement-style objectives later without architectural changes:

- `finish_under_time` — finish under per-track target
- `first_lap_under_time` — first lap under per-track target
- `beat_personal_best_by_seconds` — beat own record by a margin
- `no_reset_finish` — finish without resetting
- `no_wrong_way_finish` — finish with perfect route
- `clean_race` — no wrong-way + no reset
- `car_class_challenge` — finish with a specific class car
- `specific_car_challenge` — finish with a specific car

Future objectives will extend the `RaceRewardBreakdown.earnedBonuses` array and add config-driven objective rewards without rewriting the API route.

## Relevant config

- `src/config/rewards.ts`
  - solo Race Cash rewards (all bonus values, caps, target times)
  - multiplayer Race Cash placement rewards
- `src/config/token-rooms.ts`
  - Token Stake Rooms disabled/test-mode flags
  - temporary test mint and final production mint placeholder
  - V1 stake presets: `1,000 / 5,000 / 10,000 / 25,000 RACETE`
  - V1 pool split: creator `0%`, weekly token reward pool `15%`, treasury `5%`, player payout pool `80%`
