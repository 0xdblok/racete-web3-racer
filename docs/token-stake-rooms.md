# Token Stake Rooms V1 — Architecture Spec

Status: **Architecture only — not implemented, not enabled**

Token mint configuration:

```env
# Temporary dev/test token mint only. Do not use as final production Pump.fun token.
RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump

# Final production Pump.fun token mint. Still pending and must remain a placeholder until provided.
RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT
```

This document defines the proposed V1 architecture for **multiplayer Token Stake Rooms** in RaceTE Web3 Racer. It must be reviewed before any production code is written.

## Non-Goals / Hard Boundaries

For this architecture pass:

- Do **not** implement token rooms yet.
- Do **not** enable token stake rooms in production.
- Do **not** add on-chain transactions yet.
- Do **not** modify current multiplayer Race Cash reward logic.
- Do **not** modify solo rewards, missions, weekly competitions, garage, or Race Cash logic.
- Do **not** expose token-room secrets with `NEXT_PUBLIC_`.
- Do **not** use fixed token rewards. Token payouts must come from the **actual collected pool**.

## Current Game Modes

### Free Race — Live

- Multiplayer racing is live.
- Server-authoritative checkpoint/lap/finish validation is active.
- Multiplayer Race Cash rewards are paid through signed HMAC payloads.
- Minimum anti-cheat is active.
- No on-chain token stake is involved.

### Token Stake Race — Coming Soon

- Multiplayer room where each player stakes the same amount of the existing Pump.fun SPL token.
- Server verifies deposits before allowing players into the token-stake race lobby.
- Server-authoritative race result decides valid finishers and placements.
- On-chain payout/refund system distributes the collected token pool.

## V1 Room Rules

- Players per room: **2 to 6**.
- Race type: multiplayer only.
- Token: existing Pump.fun SPL token. Final production mint remains placeholder `RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT` until provided.
- Dev/test flows should use temporary test mint `RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump`.
- Production/mainnet flows must not use `RACETE_TEST_TOKEN_MINT`; they must use `RACETE_TOKEN_MINT` only after the final Pump.fun mint is provided.
- Stake amount is selected by the room creator before the room opens.
- Every player in the same room must stake the **exact same amount**.
- Other players can only join if they accept and deposit that same stake.
- Supported V1 stake presets:
  - `1,000 RACETE`
  - `5,000 RACETE`
  - `10,000 RACETE`
  - `25,000 RACETE`
- Custom stake: later, not V1.
- DNF and disqualified players receive `0`.
- Only finished valid players can receive token payout.
- No Race Cash payout in token stake rooms for V1. Reason: V1 should avoid mixing off-chain Race Cash rewards with on-chain stake payouts until token-room economics and anti-abuse controls are reviewed separately.

## Pool and Fee Logic

Total room pool:

```text
totalPool = stakeAmount * numberOfDepositedPlayers
```

All payouts must be calculated from the **actual collected pool**, not from expected room size.

Final V1 pool distribution:

```text
creatorFee:                    0%
weeklyTokenStakeRewardPool:    15% -> TOKEN_WEEKLY_REWARD_WALLET
platformTreasury:              5%  -> TOKEN_TREASURY_WALLET
playerPayoutPool:              80% -> automatic player winner payouts
```

### Wallet Model

Required wallet environment variables:

```env
TOKEN_TREASURY_WALLET=ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG
TOKEN_WEEKLY_REWARD_WALLET=4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw
TOKEN_VAULT_AUTHORITY=...
```

Rules:

- `TOKEN_TREASURY_WALLET` is the public wallet address that receives the 5% platform/treasury fee.
- `TOKEN_WEEKLY_REWARD_WALLET` is the public wallet address that receives the 15% weekly token stake reward pool.
- Treasury and weekly reward wallets should be public addresses only; they do not need private keys in client or frontend code.
- Production treasury and weekly reward wallets should ideally be controlled by a multisig or secure operational wallet.
- `TOKEN_VAULT_AUTHORITY` represents the server-side vault signing authority or safer equivalent signer setup.
- Any private key/signer material for the vault authority must remain server-side only.
- Never prefix signer/private env vars with `NEXT_PUBLIC_`.

### Creator Fee Policy

Creator fees are removed entirely for V1.

Recommended V1 default:

- Do not implement creator fees in V1.
- Do not reserve any creator allocation in V1.
- Do not add creator fee payout logic, allowlists, or pending creator fee accounting in V1.

Reasoning:

- Creator fees create abuse risk through fake rooms, farming, collusion, and incentive manipulation.
- Removing creator fees keeps V1 simpler and safer.
- Creator incentives can be reconsidered later only after stronger anti-cheat, admin tooling, and abuse monitoring exist.

### Weekly Token Stake Reward Pool

- Denominated in RACETE token.
- Funded from every Token Stake Room.
- Allocation: 15% of the actual collected pool.
- Transferred automatically to `TOKEN_WEEKLY_REWARD_WALLET` as part of race settlement.
- The app should track/report accumulated weekly RACETE collected from token stake rooms.
- No automatic weekly leaderboard payout in V1.
- Admin manually reviews weekly leaderboard winners.
- Admin manually sends weekly token payouts from the weekly reward wallet.
- Future automation can be added only after stronger anti-cheat, admin tooling, and payout review systems.

### Weekly Token Reward Snapshot System

V1 weekly token reward distribution must be based on a frozen 7-day snapshot, not a live leaderboard query at payout time.

Recommended cadence:

```text
Week window: Monday 00:00 UTC -> next Monday 00:00 UTC
weekId format: ISO week, e.g. 2026-W26
snapshot cadence: every 7 days after weekEnd
```

Snapshot purpose:

- Freeze the weekly token room leaderboard at `weekEnd`.
- Freeze total RACETE collected into the weekly token stake reward pool for that week.
- Freeze each eligible wallet's rank, metrics, eligibility state, DQ count, and suspicious flags.
- Give admins a stable review object for manual weekly token payouts.
- Record manual payout transaction signatures after admin sends RACETE from `TOKEN_WEEKLY_REWARD_WALLET`.

Snapshot header fields (`weekly_token_snapshots`):

- `id` — UUID primary key
- `weekId` — ISO week, e.g. `2026-W26`
- `weekStart` — Monday 00:00 UTC
- `weekEnd` — next Monday 00:00 UTC
- `snapshotCreatedAt` — when snapshot was created
- `tokenMint` — active token mint for the week (`RACETE_TEST_TOKEN_MINT` in dev/test; `RACETE_TOKEN_MINT` in production after final mint is provided)
- `weeklyRewardWalletAddress` — `TOKEN_WEEKLY_REWARD_WALLET` at snapshot time
- `treasuryWalletAddress` — `TOKEN_TREASURY_WALLET` at snapshot time
- `totalWeeklyTokenStakeRewardPoolAmount` — total RACETE collected into the weekly pool from settled token rooms in `[weekStart, weekEnd)`
- `totalTokenRoomVolume` — total staked RACETE across all settled token rooms in the week
- `totalTokenRoomsCount` — number of settled token rooms in the week
- `leaderboardCategory` — ranking category, default `token_room_weekly_composite`
- `rankingBasis` — JSONB describing sort keys (e.g. wins → netPnL → validFinishRate → DQ count → bestTime)
- `snapshotStatus` — `pending_review` | `reviewed` | `paid` | `disputed`
- `reviewedAt` — when admin finalized review
- `reviewedBy` — admin/operator identifier
- `adminNotes` — free-text admin notes

Snapshot entry fields (`weekly_token_snapshot_entries`):

- `walletAddress` — Solana wallet public key
- `rank` — integer position (1 = top)
- `totalTokenRoomWins` — number of token stake rooms won
- `totalTokenRoomRaces` — number of token stake rooms entered
- `validFinishes` — races finished without DNF/DQ
- `dnfCount` — number of DNF (did not finish)
- `dqCount` — number of DQ (disqualified)
- `suspiciousEventCount` — total suspicious anti-cheat events across all races
- `totalStakeVolume` — total RACETE staked across all entered rooms
- `grossTokenWinnings` — total RACETE received from race payouts before stake cost
- `totalTokenStaked` — sum of all stake amounts deposited
- `netTokenPnl` — gross winnings minus total staked (can be negative)
- `bestTimeMs` — best multiplayer race time in milliseconds (tie-breaker)
- `winRate` — validFinishes / totalTokenRoomRaces (0–1)
- `payoutEligible` — boolean, computed: DQ count = 0 AND suspicious event count below threshold AND wallet not flagged
- `adminReviewStatus` — `unreviewed` | `cleared` | `flagged` | `blocked`; set by admin during review
- `suggestedPayoutAmount` — advisory amount in RACETE; admin may adjust
- `manualPayoutStatus` — `unpaid` | `paid` | `blocked` | `under_review`
- `manualPayoutSignature` — Solana transaction signature recorded after admin sends RACETE
- `adminNotes` — free-text per-player admin notes

Immutability rule:

- Snapshot data should be immutable after final review.
- After final review, only admin notes and manual payout transaction signatures may be appended/updated.
- The ranking, week window, total weekly pool amount, and eligibility metrics must not be silently recomputed after review.

Primary V1 weekly token reward ranking basis (default `token_room_weekly_composite`):

Sort order:

1. Most token room wins (descending).
2. Highest net token PnL (descending).
3. Highest valid finish rate (descending).
4. Lowest DQ + suspicious event count (ascending).
5. Best multiplayer time as tie-breaker (ascending).

Alternative ranking categories (documented for future admin selection):

| Category ID | Sort keys | Description |
|---|---|---|
| `most_wins` | wins desc, netPnl desc, bestTime asc | Pure win count |
| `highest_pnl` | netPnl desc, wins desc, bestTime asc | Profit-oriented ranking |
| `best_win_rate` | winRate desc, wins desc, netPnl desc | Efficiency ranking |
| `most_volume` | totalStakeVolume desc, wins desc, netPnl desc | Volume commitment ranking |
| `best_race_time` | bestTime asc, wins desc, netPnl desc | Pure speed ranking |
| `risk_adjusted` | netPnl desc, winRate desc, dqCount asc, bestTime asc | Risk-adjusted profit |

The snapshot header records which `leaderboardCategory` was used so the ranking basis is auditable per week.

Manual weekly payout process:

1. Weekly window closes at Monday 00:00 UTC.
2. Admin triggers snapshot creation, or scheduled automation creates a pending snapshot.
3. Snapshot freezes leaderboard entries and weekly token pool totals.
4. Admin reviews top players, DQ flags, suspicious events, and abnormal wallet patterns.
5. Admin marks entries `paid`, `blocked`, or `under_review`.
6. Admin manually sends RACETE from `TOKEN_WEEKLY_REWARD_WALLET`.
7. Admin records payout signatures against snapshot entries/manual payout rows.
8. Snapshot remains auditable for later review.

Automation policy:

- V1 recommended: admin-triggered snapshot endpoint or admin action.
- Later: Vercel Cron every Monday.
- Alternative: VPS cron calls the snapshot endpoint.
- No automatic weekly token payout in V1.

### Player Payout Pool Split

For 3+ valid finishers:

```text
1st place: 65% of playerPayoutPool
2nd place: 25% of playerPayoutPool
3rd place: 10% of playerPayoutPool
```

For exactly 2 valid finishers:

```text
1st place: 75% of playerPayoutPool
2nd place: 25% of playerPayoutPool
```

For exactly 1 valid finisher:

```text
1st place: 100% of playerPayoutPool
```

For 0 valid finishers:

- No automatic player payout.
- Room enters `manual_review` or `refund_pending`, depending on final security policy.
- Recommended V1: `manual_review`, because all-DNF/all-DQ may indicate exploit, server failure, or griefing.

### Example

Six players stake 10,000 RACETE each:

```text
totalPool = 60,000 RACETE
weeklyTokenStakeRewardPool = 9,000 RACETE (15%)
platformTreasury = 3,000 RACETE (5%)
playerPayoutPool = 48,000 RACETE (80%)
creatorFee = 0 RACETE (0%)
```

If 3+ valid finishers:

```text
1st place = 31,200 RACETE (65% of playerPayoutPool)
2nd place = 12,000 RACETE (25% of playerPayoutPool)
3rd place = 4,800 RACETE  (10% of playerPayoutPool)
```

## Recommended Custody Model

### Options Compared

#### Option 1 — Server Wallet Custody

Players transfer tokens to a server-controlled vault token account. Backend verifies deposits and later signs payouts/refunds from a hot wallet.

Pros:

- Fastest to build.
- No custom Solana program required.
- Works with standard SPL token transfers.
- Easier to operate during private beta.

Cons:

- Server wallet compromise can drain the vault.
- Requires strict operational security.
- More trust-based than program escrow.
- Manual reconciliation needed after crashes or failed payouts.

#### Option 2 — Program Escrow / Smart Contract Escrow

A Solana program owns escrow accounts and enforces deposit/payout/refund rules.

Pros:

- Stronger trust model.
- Payout/refund rules can be enforced on-chain.
- Server compromise cannot arbitrarily drain funds if program is written correctly.

Cons:

- Highest build/security/audit cost.
- Requires Solana program development and review.
- More time before V1 beta.
- On-chain race result oracle still requires server signature or admin authority.

#### Option 3 — Multisig Treasury Custody

Deposits go to a vault controlled by a multisig authority.

Pros:

- Safer long-term treasury custody.
- Reduced single-key risk for platform funds.

Cons:

- Poor UX for automated room payouts if every payout requires multisig signing.
- Still needs a hot payout authority or program for real-time settlement.

#### Option 4 — Direct Transfer to Vault + Manual Payout

Players transfer to a vault, and payouts are performed manually by an operator/admin.

Pros:

- Safest early test mode.
- Easy to pause/review suspicious races.
- No automated payout bugs can drain funds.

Cons:

- Bad UX.
- Does not scale.
- Requires operational support.

#### Option 5 — Fully On-Chain Escrow

All deposits, race finalization, fee routing, and payouts are handled on-chain.

Pros:

- Best trust minimization.
- Strongest user confidence after audit.

Cons:

- Not realistic for immediate V1 unless the project already has a reviewed program.
- Race result still comes from off-chain game server, so oracle trust remains.

### Recommendation for V1

Recommended realistic V1 path:

1. **Devnet/local:** server wallet custody with isolated room deposit records and strict verification.
2. **Closed mainnet beta:** server wallet custody with small stake caps, manual review fallback, daily withdrawal limits, and monitoring.
3. **Post-beta:** migrate to program escrow or hybrid program escrow once economics and race integrity are proven.

Why:

- The game already relies on a server-authoritative race server.
- The immediate risk is engineering/anti-cheat correctness, not trustless settlement.
- V1 should prioritize low stake caps, strong auditing, and emergency pause over premature smart-contract complexity.
- A custom escrow program should be reviewed/audited before holding meaningful funds.

Recommended V1 custody details:

- One vault token account per mint, owned by a restricted vault authority.
- Room-level accounting in DB isolates funds by `room_id` and `race_id`.
- Every deposit must include exact mint, exact amount, exact source wallet, exact destination vault ATA, confirmed signature.
- Payout/refund logic must be idempotent and audit-logged.
- Any discrepancy between expected room accounting and on-chain vault deltas blocks payout and enters manual review.

## Solana Transaction Flow

### 1. Wallet Connects

- User connects Solana wallet.
- Frontend reads token balance for the active token mint: `RACETE_TEST_TOKEN_MINT` in dev/test, `RACETE_TOKEN_MINT` only in production after the final Pump.fun mint is provided.
- Token Stake Rooms remain disabled until the feature flag is enabled.

### 2. Room Creator Selects Stake

- Creator selects one preset stake: 1k / 5k / 10k / 25k RACETE.
- Creator selects player cap: 2-6.
- Backend creates a room record with status `created` or `depositing`.
- Room receives a stable `room_id`; later race receives `race_id`.

### 3. Join Intent

Client calls:

```text
POST /api/token-rooms/join-intent
```

Backend returns:

- room id
- token mint
- exact stake amount in base units
- vault token account address
- expected owner/authority metadata
- deposit nonce/reference memo if used
- expiration timestamp

### 4. User Approves Deposit

User signs SPL token transfer:

```text
user ATA -> room vault ATA
amount = exact stakeAmount
mint = active token mint (RACETE_TEST_TOKEN_MINT in dev/test; RACETE_TOKEN_MINT in production after final mint is provided)
```

Recommended: include memo/reference containing `room_id`, `wallet_address`, and join intent id if possible.

### 5. Backend Confirms Deposit

Client submits signature:

```text
POST /api/token-rooms/confirm-deposit
```

Backend verifies on-chain:

- transaction finalized/confirmed enough for policy
- instruction is SPL token transfer or transferChecked
- mint matches the active token mint (`RACETE_TEST_TOKEN_MINT` in dev/test; `RACETE_TOKEN_MINT` in production after final mint is provided)
- source owner matches wallet address
- destination equals vault ATA
- amount equals room stake amount
- signature not already used
- join intent not expired
- room is still accepting deposits
- token decimals match expected mint metadata

Only after this passes:

- insert/update `token_deposits.status = confirmed`
- insert/update `token_room_players.deposit_status = confirmed`
- allow player into Colyseus token room

### 6. Lobby Starts

- Colyseus token room only accepts players with confirmed deposit.
- No start until all required deposits are confirmed and min players reached.
- Once race starts, room transitions to `racing`; deposits are no longer refundable except through result/failure policy.

### 7. Race Finalizes

- Colyseus uses server-authoritative results.
- DQ/DNF/disconnected players are not eligible for winner payout.
- Colyseus sends a signed finalize payload to backend.
- Backend validates HMAC/server secret, room status, race id, result hash, and no prior finalization.

### 8. Payout Transaction

Backend computes payout from actual confirmed pool:

```text
confirmedPool = sum(confirmed deposits)
creatorFee = 0%
weeklyTokenStakeRewardPool = 15%
treasuryFee = 5%
playerPayoutPool = 80%
winners = valid finished players only
```

Backend builds and sends automatic race settlement transaction(s):

- valid finisher player payouts from the 80% player payout pool
- 5% treasury fee to `TOKEN_TREASURY_WALLET`
- 15% weekly token stake reward pool allocation to `TOKEN_WEEKLY_REWARD_WALLET`

Each transfer is recorded in `token_payouts` with transaction signature. Weekly leaderboard rewards are **not** distributed automatically in V1; only the weekly pool funding transfer is automatic.

### 9. Refunds

Refunds apply when:

- room cancels before race starts
- room never fills before `expires_at`
- server fails before race start
- manual review decides refund

Refund transaction sends each confirmed stake back to the depositor wallet ATA.

## Escrow / Vault Design

### Vault Owner

V1 recommended:

- A dedicated vault authority keypair, not the game server deployment key.
- Stored only server-side, never exposed to browser.
- Ideally controlled by an HSM/KMS or signer service.
- For early beta, at minimum: encrypted env/secret manager + low limits + emergency pause.

Long-term recommended:

- Program-owned escrow accounts or multisig-controlled treasury.

### Token Account Creation

- Create a vault ATA for the active token mint (`RACETE_TEST_TOKEN_MINT` in dev/test; `RACETE_TOKEN_MINT` in production after final mint is provided).
- Do not accept deposits to arbitrary token accounts.
- Validate token account mint and owner for every deposit.
- Consider separate vault token accounts per room if operationally feasible.

### Room Isolation

V1 minimal isolation:

- One shared vault ATA per mint.
- Strong DB accounting per `room_id`.
- Every deposit row references room id, wallet, amount, mint, signature.
- Vault balance reconciliation verifies sum of unsettled confirmed deposits.

Safer isolation:

- One derived vault token account per room or per race.
- More expensive/complex but reduces fund-mixing risk.

Recommended V1:

- Start with one vault ATA + strict DB accounting in devnet.
- For mainnet beta, prefer per-room vault token accounts if signer/ATA management is reliable.

### Room ID / Race ID Mapping

- `room_id`: lobby identity, stable from creation to close.
- `race_id`: created when race starts, unique per started race.
- `server_race_id`: Colyseus result id, included in signed finalize payload.
- `room_id` may exist without `race_id` if room never starts.

### Preventing Mixed Funds

- Deposit signature can be used once globally.
- Deposit amount must equal exact stake.
- Deposit belongs to exactly one `room_id` and one `wallet_address`.
- Confirmed pool = sum of confirmed deposits for that room.
- Payouts/refunds can only use confirmed pool for that room.
- Payout total + fees + refunds must never exceed confirmed pool minus already settled amounts.

### Failed Payout Handling

If payout transaction fails:

- Mark room `payout_failed` or `manual_review`.
- Do not retry blindly in a loop.
- Retry must use idempotency key and inspect whether prior transaction landed.
- Keep full audit event: error message, tx simulation logs if available, timestamp.

### Abandoned Rooms

If room never fills:

- `expires_at` triggers `refund_pending`.
- Players can call refund endpoint after expiry.
- Admin/cron can batch refund abandoned rooms.

If server crashes after start:

- On restart, inspect `token_rooms.status` and `token_room_events`.
- If no signed final result exists within timeout, move to `manual_review`.
- Admin can choose refund or replay finalize if authoritative event log is sufficient.

## API Design

### Client-Callable APIs

#### `GET /api/token-rooms/available`

Returns available rooms that are accepting deposits.

Response fields:

- `roomId`
- `stakeAmount`
- `tokenMint`
- `playerCount`
- `maxPlayers`
- `status`
- `creatorWallet`
- `expiresAt`

#### `GET /api/token-rooms/:id`

Returns room state and user's deposit status if wallet is provided.

#### `POST /api/token-rooms/create`

Client-callable but server validates all inputs.

Payload:

- `walletAddress`
- `stakeAmountPreset`
- `maxPlayers`

Server creates room and creator join intent.

#### `POST /api/token-rooms/join-intent`

Client-callable.

Payload:

- `walletAddress`
- `roomId`

Returns exact deposit instructions.

#### `POST /api/token-rooms/confirm-deposit`

Client-callable.

Payload:

- `walletAddress`
- `roomId`
- `joinIntentId`
- `depositSignature`

Server verifies transaction on-chain before marking deposit confirmed.

#### `POST /api/token-rooms/refund`

Client-callable when room is eligible for refund.

Payload:

- `walletAddress`
- `roomId`

Server verifies refund eligibility and sends refund transaction, or returns pending/manual review status.

### Server-Only APIs

#### `POST /api/token-rooms/start`

Server-only / Colyseus-only.

Purpose:

- Lock room after confirmed deposits.
- Set `race_id`.
- Transition room to `racing`.

Must require server signature/HMAC using `TOKEN_ROOM_SECRET`.

#### `POST /api/token-rooms/finalize`

Server-only / Colyseus-only.

Purpose:

- Submit authoritative final race result.
- Compute payouts.
- Trigger payout or manual review.

Must require:

- `TOKEN_ROOM_SECRET` HMAC.
- Known `room_id` and `race_id`.
- Room status `racing`.
- No existing finalization.
- Result players match deposited players.
- AC status clean enough for payout.

### Future Admin-Only Weekly Snapshot APIs

These endpoints are architecture-only for a future implementation. They must be admin-only and must not auto-distribute weekly token rewards.

#### `POST /api/admin/weekly-token-snapshots/create`

Creates a frozen snapshot for a completed week.

Payload:

- `weekId` optional; defaults to most recently completed ISO week.
- `forceRebuild` should be disallowed once a snapshot is reviewed/paid.

Rules:

- Admin-only.
- Week must be closed before snapshot creation.
- Snapshot captures leaderboard metrics and weekly pool totals from settled token rooms in `[weekStart, weekEnd)`.
- Snapshot starts as `pending_review`.

#### `GET /api/admin/weekly-token-snapshots`

Lists weekly snapshots with status, week window, pool amount, and review state.

#### `GET /api/admin/weekly-token-snapshots/:weekId`

Returns snapshot detail, entries, eligibility flags, suspicious/DQ counts, suggested payouts, and recorded manual payout signatures.

#### `PATCH /api/admin/weekly-token-snapshots/:weekId/review`

Updates review status and per-entry admin status.

Rules:

- DQ/disqualified players default to `blocked` or `under_review`.
- Suspicious players default to `under_review`.
- Final review freezes rank/metrics/pool totals.

#### `PATCH /api/admin/weekly-token-snapshots/:weekId/record-payout`

Records manual payout transaction signatures after admin sends RACETE from `TOKEN_WEEKLY_REWARD_WALLET`.

Rules:

- Does not send tokens automatically.
- Records `walletAddress`, `amount`, `tokenMint`, `payoutSignature`, `paidBy`, `paidAt`, and notes.
- Can update payout signatures/admin notes after review; cannot recalculate leaderboard ranking.

## Colyseus Server Changes

V1 should use a separate room type, not overload the current free race room:

```text
FreeRaceRoom       -> existing Race Cash multiplayer
TokenStakeRaceRoom -> new Coming Soon token-stake flow
```

Token room rules:

- Only confirmed-deposit players can join.
- Server receives a server-generated admission token from backend.
- No start until min players and all deposits confirmed.
- No deposits after room status becomes `locked` or `racing`.
- Race result status supports `finished`, `dnf`, `disconnected`, `disqualified`, `manual_review`.
- DQ/DNF/disconnected players receive no token payout.
- Colyseus does **not** directly send token payouts.
- Colyseus sends signed final result to backend finalize endpoint.

Recommended signed finalize payload:

```json
{
  "version": 1,
  "roomId": "token_room_...",
  "raceId": "race_...",
  "serverRaceId": "mp:...",
  "tokenMint": "TO_BE_PROVIDED_FINAL_PUMPFUN_MINT",
  "stakeAmount": "100000000000",
  "players": [
    {
      "walletAddress": "...",
      "placement": 1,
      "status": "finished",
      "totalTimeMs": 123456,
      "bestLapMs": 39000,
      "firstLapMs": 41000,
      "lapsCompleted": 3,
      "checkpointsCompleted": 30,
      "suspiciousEvents": 0,
      "dqReason": null
    }
  ],
  "finishedAt": "..."
}
```

Sign with HMAC using `TOKEN_ROOM_SECRET`, separate from `MULTIPLAYER_REWARD_SECRET`.

## Anti-Cheat Requirements Before Token Rooms

Before mainnet token stake rooms are enabled, the following must be true:

- Server-side track/checkpoint data must be complete and versioned.
- Checkpoint proximity must be validated with known track coordinates.
- Speed caps must be class-aware and calibrated from real race telemetry.
- Teleport detection must be tested with normal latency/packet loss.
- Finish plausibility must include minimum lap time, total time, checkpoints, and race duration.
- Suspicious logs must be stored durably, not only console logs.
- Race replay/audit events must include movement/checkpoint/finish timeline.
- DQ rules must be deterministic and visible in audit logs.
- Manual admin review path must exist for suspicious or ambiguous races.
- Payout must be blocked if anti-cheat uncertainty exceeds threshold.
- Emergency pause switch must exist for token rooms.

Recommended V1 safety rule:

```text
If anti-cheat confidence is uncertain, do not pay automatically.
Move room to manual_review.
```

## Payout Cases

### Normal Finish

- Valid finishers ranked by server placement.
- Fees allocated first.
- Player payout pool split among top valid finishers.
- Payout transaction(s) sent.
- Room status becomes `paid`.

### Winner DQ

- DQ player gets 0.
- Next valid finisher becomes highest eligible placement.
- If at least one valid finisher exists, payout based on valid finisher count.
- Audit event records original placement and DQ reason.

### All DNF / All DQ

- No winner payout.
- Recommended V1: move to `manual_review`.
- Admin decides refund vs partial treasury action after review.

### Player Disconnect Before Race Start

- If deposit confirmed and room not started: player can refund.
- Room frees player slot after timeout.

### Player Disconnect After Race Start

- Player status becomes `disconnected` / `dnf`.
- Player receives 0 winner payout.
- Stake remains in pool unless manual review decides otherwise.

### Room Never Fills

- At `expires_at`, room becomes `refund_pending`.
- Confirmed players can refund full stake.

### Race Timeout

- If some valid finishers exist and server can finalize confidently, payout valid finishers.
- If timeout indicates server/race integrity issue, move to `manual_review`.

### Server Crash

- If crash before race start: refund.
- If crash after race start and no authoritative final result: manual review.
- If final result was signed and stored before crash: finalize idempotently.

### Payout Transaction Fails

- Mark `payout_failed`.
- Store failure details.
- Do not duplicate-send.
- Operator or retry worker checks chain status before retry.

### Duplicate Payout Attempt

- Rejected by DB uniqueness and idempotency:
  - one finalization per `race_id`
  - one payout row per `room_id + wallet_address + payout_type`
  - one transaction signature globally

## UI / UX Design

### Token Stake Rooms Card

Homepage/multiplayer UI should keep the existing Coming Soon card until feature flag is enabled.

Card states:

- Coming Soon — disabled, no deposit buttons.
- Beta Locked — visible but requires allowlist.
- Available — rooms listed with stake amount and player count.

### Room Creation UI

- Stake preset selector: 1k / 5k / 10k / 25k RACETE.
- Player cap selector: 2-6.
- Token balance check.
- Clear warning: beta, token at risk, anti-cheat/manual review possible.

### Join Flow

- Show required stake amount.
- Show user's token balance.
- Button: `Approve & Deposit`.
- States:
  - checking balance
  - awaiting wallet signature
  - confirming on-chain deposit
  - deposit confirmed
  - waiting for players
  - refund available

### Lobby UI

- Each player row shows:
  - wallet short address
  - deposit confirmed badge
  - ready state
  - disconnected/DQ if applicable
- Start button is server-controlled; players cannot force start.

### Result UI

- Show pot breakdown:
  - total collected pool
  - creator fee: 0%
  - weekly token stake reward pool
  - treasury fee
  - player payout pool
- Show payouts by placement.
- Show DQ/DNF players as `0 RACETE`.
- Show payout status:
  - pending
  - paid
  - manual review
  - refund available
  - payout failed

## Environment Variables

Server/backend only — never `NEXT_PUBLIC_`:

```env
# Temporary dev/test token mint only.
RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump

# Final production Pump.fun token mint. Must remain placeholder until provided.
RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT

SOLANA_RPC_URL=...
TOKEN_ROOM_SECRET=...
TOKEN_VAULT_AUTHORITY=...
TOKEN_TREASURY_WALLET=ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG
TOKEN_WEEKLY_REWARD_WALLET=4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw
TOKEN_ROOMS_ENABLED=false
TOKEN_ROOMS_MAINNET_ENABLED=false
```

Existing secret remains separate:

```env
MULTIPLAYER_REWARD_SECRET=...
```

Notes:

- `RACETE_TEST_TOKEN_MINT` is temporary and only for dev/test implementation flows.
- `RACETE_TOKEN_MINT` is the final production Pump.fun mint placeholder; production/mainnet flows must not use the test mint.
- `TOKEN_ROOM_SECRET` signs server-only token-room lifecycle events.
- `MULTIPLAYER_REWARD_SECRET` remains only for free multiplayer Race Cash rewards.
- V1 creator fee is 0%; no creator fee env var is required.
- Weekly pool funding transfers to `TOKEN_WEEKLY_REWARD_WALLET` are automatic after race settlement; weekly leaderboard reward distribution remains admin-reviewed/manual-payout only in V1.
- Token vault authority should eventually be replaced by KMS/signer service or program escrow.

## Recommended V1 Implementation Plan

### Phase A — DB Schema + Docs

- Add schema migrations for token-room tables later, after this spec is approved.
- Include future weekly snapshot tables in the schema plan: `weekly_token_snapshots`, `weekly_token_snapshot_entries`, and `weekly_token_manual_payouts`.
- No runtime token logic.
- No UI enabling.
- Add admin-facing audit documentation.

### Phase B — Token Balance Read + Disabled Preview

- Frontend can read RACETE token balance.
- Token rooms still disabled.
- UI shows coming soon / beta locked state.

### Phase C — Deposit Verification on Devnet/Local Only

- Build join-intent and confirm-deposit endpoints.
- Verify SPL token transfers on devnet.
- No mainnet deposits.

### Phase D — Escrow/Vault Test

- Test shared vault and/or per-room vault.
- Reconcile vault balance vs DB.
- Test refunds and failed transaction paths.

### Phase E — Token Room Colyseus Gating

- Add `TokenStakeRaceRoom`.
- Only deposit-confirmed players can join.
- No race start until room locked and deposits confirmed.

### Phase F — Server-Authoritative Finalize

- Token room sends signed final result to backend.
- Backend validates anti-cheat status and computes payout plan.
- No automatic payout on suspicious races.

### Phase G — Payout / Refund

- Implement idempotent token payout/refund transaction sender.
- Add manual review and admin tooling.
- Test duplicate payout and retry safety.

### Phase H — Mainnet Beta with Small Stake Caps

- Enable only 1,000 RACETE rooms initially.
- Allowlist users and token-room beta participants.
- Daily caps and emergency pause.
- Manual review for suspicious races.
- Increase stake caps only after telemetry is clean.

## What Must Be True Before Coding Starts

- Temporary test mint recorded for dev/test flows: `RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump`.
- Final production token mint confirmed: `RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT` replaced with real Pump.fun mint before any production/mainnet flow.
- Custody model selected and approved.
- Fee wallets selected and secured.
- RPC provider selected with reliable transaction history access.
- Anti-cheat thresholds validated against normal multiplayer races.
- Room cancellation/refund policy approved.
- Manual review process defined.
- Admin/operator access model defined.
- Emergency pause plan defined.
- Creator fee removed from V1.
- Weekly token stake reward pool manual review/distribution process defined.

## Open Questions

- Should V1 use one shared vault ATA or one per-room vault ATA on mainnet beta?
- What confirmation level is acceptable for deposits: `confirmed` vs `finalized`?
- What max total room pool should be allowed during beta?
- Who operates manual review and refund approvals?
- Who operates weekly token stake reward pool review and manual distribution?
- Should all-DNF/all-DQ default to refund or manual review?
