# Token Stake Rooms V1 — Architecture Spec

Status: **Architecture only — not implemented, not enabled**

Token placeholder:

```env
RACETE_TOKEN_MINT=TO_BE_PROVIDED_PUMPFUN_MINT
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
- Token: existing Pump.fun SPL token, mint placeholder `RACETE_TOKEN_MINT=TO_BE_PROVIDED_PUMPFUN_MINT`.
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
weeklyTokenStakeRewardPool:    15%
platformTreasury:              5%
playerPayoutPool:              80%
```

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
- No automatic weekly payout in V1.
- Admin manually reviews weekly winners.
- Admin manually distributes weekly token rewards.
- Future automation can be added only after stronger anti-cheat, admin tooling, and payout review systems.

Future weekly winner criteria may include:

- best multiplayer performance
- most token room wins
- best win rate
- best total profit
- best weekly leaderboard rank

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
- Frontend reads token balance for `RACETE_TOKEN_MINT`.
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
mint = RACETE_TOKEN_MINT
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
- mint matches `RACETE_TOKEN_MINT`
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
platformFee = 5%
playerPayoutPool = 80%
winners = valid finished players only
```

Backend builds and sends payout transaction(s):

- player payouts
- platform/treasury fee
- weekly token stake reward pool allocation

Each transfer is recorded in `token_payouts` with transaction signature.

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

- Create a vault ATA for `RACETE_TOKEN_MINT`.
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
  "tokenMint": "TO_BE_PROVIDED_PUMPFUN_MINT",
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
  - platform fee
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
RACETE_TOKEN_MINT=TO_BE_PROVIDED_PUMPFUN_MINT
SOLANA_RPC_URL=...
TOKEN_ROOM_SECRET=...
TOKEN_VAULT_AUTHORITY_PRIVATE_KEY=...
PLATFORM_FEE_WALLET=...
WEEKLY_TOKEN_STAKE_REWARD_POOL_WALLET=...
TOKEN_ROOMS_ENABLED=false
TOKEN_ROOMS_MAINNET_ENABLED=false
```

Existing secret remains separate:

```env
MULTIPLAYER_REWARD_SECRET=...
```

Notes:

- `TOKEN_ROOM_SECRET` signs server-only token-room lifecycle events.
- `MULTIPLAYER_REWARD_SECRET` remains only for free multiplayer Race Cash rewards.
- V1 creator fee is 0%; no creator fee env var is required.
- Weekly token stake rewards are tracked/admin-reviewed/manual-payout only in V1.
- Token vault authority should eventually be replaced by KMS/signer service or program escrow.

## Recommended V1 Implementation Plan

### Phase A — DB Schema + Docs

- Add schema migrations for token-room tables.
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
- Allowlist users/creators.
- Daily caps and emergency pause.
- Manual review for suspicious races.
- Increase stake caps only after telemetry is clean.

## What Must Be True Before Coding Starts

- Token mint confirmed: `RACETE_TOKEN_MINT=TO_BE_PROVIDED_PUMPFUN_MINT` replaced with real Pump.fun mint.
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
