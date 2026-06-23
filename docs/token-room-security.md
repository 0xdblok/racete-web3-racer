# Token Stake Rooms V1 — Security Spec

Status: **Phase C.3 implementation — automatic settlement/payout MVP; Token Stake Rooms still disabled/test mode until production launch gates pass**

Token mint configuration:

```env
# Temporary dev/test token mint only. Do not use as final production Pump.fun token.
RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump

# Final production Pump.fun token mint. Still pending and must remain a placeholder until provided.
RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT

# Phase C.3 custodial payout MVP. Server-only. Never NEXT_PUBLIC. Never commit a real value.
TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64=<SERVER_ONLY_BASE64_ENCODED_VAULT_SECRET_KEY>
```

## Phase C.3 Custodial MVP Warning

Automatic payout execution is custodial in Phase C.3:

- The deposit vault wallet is `FxDUd2EgPDLtDgCeko18VyrLJ8eAviN96NHcyDbYt18`.
- The server derives the vault public key from `TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64` and refuses payout if it does not match that vault wallet.
- The private key must exist only in server runtime environment variables.
- Do not expose the private key through `NEXT_PUBLIC_*`, browser code, API responses, logs, docs, commits, screenshots, or support tickets.
- Settlement math must use only confirmed `token_deposits` filtered by `room_id`; the global vault balance is only an execution capacity check.
- If signer validation, RPC confirmation, anti-cheat, or result validity is unclear, move the room to `manual_review` and do not auto-send payouts.
```

This document defines the minimum security requirements, threat model, mitigations, and launch gates for RaceTE Token Stake Rooms.

## Final V1 Pool Distribution

For every Token Stake Room:

```text
Total pool = stakeAmount × numberOfPlayers
Creator fee = 0%
Weekly token stake reward pool = 15%
Treasury fee = 5%
Player payout pool = 80%
```

Security policy:

- Do not implement creator fees in V1.
- Do not auto-distribute the weekly token stake reward pool in V1.
- Weekly token rewards are admin-reviewed/manual-payout only.
- Player payouts are paid only to valid finishers from the 80% player payout pool.

## Security Principles

1. **No client trust**
   - Clients may request intents and submit signatures.
   - Clients never decide deposits, room admission, results, payouts, fees, or refunds.

2. **On-chain verification for deposits**
   - A deposit is not real until backend verifies the Solana transaction against exact expected fields.

3. **Server-authoritative race result**
   - Placement and DQ/DNF status come only from Colyseus server-authoritative result.

4. **Separate secrets**
   - `TOKEN_ROOM_SECRET` is only for token-room lifecycle/finalize signing.
   - `MULTIPLAYER_REWARD_SECRET` remains only for free multiplayer Race Cash reward claims.

5. **Fail closed**
   - If deposit, anti-cheat, finalization, payout, or RPC verification is uncertain, block automatic payout and move to manual review.

6. **Idempotency everywhere**
   - Deposits, finalization, payouts, and refunds must be safe to retry without double-crediting or double-sending funds.

7. **Auditability before automation**
   - Token rooms must write durable audit events before any mainnet beta.

8. **Frozen weekly reward snapshots**
   - Weekly token rewards must be manually distributed from an immutable 7-day snapshot, not from a mutable live leaderboard.
   - No automatic weekly token reward payout in V1.

## Trust Boundaries

### Browser Client

Trusted for:

- Rendering UI.
- Requesting room/join intents.
- Asking wallet to sign SPL token transfers.
- Submitting transaction signatures.

Not trusted for:

- Deposit amount.
- Token mint.
- Destination vault.
- Room stake.
- Race results.
- Payout split.
- DQ status.
- Refund eligibility.

### Next.js Backend APIs

Trusted for:

- Creating canonical room records.
- Generating deposit instructions.
- Verifying Solana transactions.
- Writing DB audit log.
- Building payout/refund transactions.
- Validating Colyseus signed results.

Risk:

- If API secret or vault authority is compromised, funds may be at risk.

### Colyseus Game Server

Trusted for:

- Token-room admission gating after backend confirmation.
- Server-authoritative race state.
- Anti-cheat decisions.
- Final result signing.

Risk:

- If game server is compromised, malicious final results could be submitted unless backend performs consistency checks and audit review.

### Solana RPC Provider

Trusted for:

- Transaction lookups.
- Balance reads.
- Signature status.

Risk:

- RPC lag, inconsistency, incorrect commitment level, or outage can block deposit/payout/refund flows.

### Vault Authority

Trusted for:

- Sending token payouts/refunds.

Risk:

- Highest-risk secret in a server-wallet custody model.
- Must not be exposed to browser or public logs.

## Required Secrets / Environment Variables

Server/backend only:

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

Existing multiplayer reward secret remains separate:

```env
MULTIPLAYER_REWARD_SECRET=...
```

Rules:

- `RACETE_TEST_TOKEN_MINT` is a temporary test mint for dev/test flows only.
- `RACETE_TOKEN_MINT` remains the final production Pump.fun mint placeholder until the real mint is provided.
- Production/mainnet flows must reject `RACETE_TEST_TOKEN_MINT`; they must use `RACETE_TOKEN_MINT` only after the final mint is set.
- `TOKEN_TREASURY_WALLET` and `TOKEN_WEEKLY_REWARD_WALLET` are public recipient addresses only.
- Production treasury and weekly reward wallets should ideally be controlled by a multisig or secure operational wallet.
- `TOKEN_VAULT_AUTHORITY` is server-side signer configuration or an equivalent secure signer setup.
- Any private key/signer material must stay server-side only.
- No token-room secret or private signer env var can be prefixed with `NEXT_PUBLIC_`.
- Secret values must never be logged.
- Signed payout payloads may be logged only without signatures/private keys.
- Creator fees are 0% in V1 and must not be implemented.
- Weekly token stake rewards are transferred automatically to `TOKEN_WEEKLY_REWARD_WALLET`, tracked in RACETE, admin-reviewed, and manually distributed in V1.
- Do not send automatic weekly leaderboard payouts in V1.
- Vault authority private key should eventually move to KMS/signer service or program escrow.

## Threats and Mitigations

### 1. Client Spoofing

Threat:

- Client claims it deposited, finished first, or is eligible for payout.

Mitigation:

- Deposit requires on-chain transaction verification.
- Room admission requires server-generated confirmed deposit status.
- Final race result must come from Colyseus signed payload.
- Payout is computed server-side only.

### 2. Fake Deposit

Threat:

- Client submits a random signature or transfer to the wrong token/vault/amount.

Mitigation:

Backend must verify:

- transaction exists and is sufficiently confirmed
- transfer instruction references exact token mint
- amount equals room stake amount in base units
- source token owner matches wallet address
- destination token account equals canonical vault ATA
- deposit signature unused
- join intent is valid and unexpired
- room status accepts deposits

### 3. Duplicate Deposit Claim

Threat:

- Same deposit signature is reused for multiple rooms or wallets.

Mitigation:

- Unique index on `token_deposits.deposit_signature`.
- Deposit row binds signature to `room_id`, `wallet_address`, `stake_amount`, and `token_mint`.
- Join intent can be consumed only once.

### 4. Deposit Amount / Mint Mismatch

Threat:

- User transfers wrong token or partial amount.

Mitigation:

- Backend rejects any transaction where mint or base-unit amount differs exactly.
- UI should warn users not to manually transfer tokens outside generated intent.
- Wrong deposits enter manual support path, not automatic credit.

### 5. Token Account Mismatch

Threat:

- User sends from a token account not owned by the claiming wallet, or to a fake vault.

Mitigation:

- Verify source token account owner.
- Verify destination token account address and mint.
- Do not accept arbitrary recipient accounts.

### 6. Replay / Front-Running

Threat:

- Old join intent or finalize payload is replayed.

Mitigation:

- Join intents have `expires_at` and one-time `intent_id`.
- Finalize payload includes `room_id`, `race_id`, `server_race_id`, `result_hash`, `finished_at`.
- Backend enforces one finalization per race.
- HMAC signatures include canonical payload fields.

### 7. Payout Double-Send

Threat:

- Retry or concurrent finalize sends payouts twice.

Mitigation:

- DB transaction/locking around finalization.
- Unique payout rows by `room_id + wallet_address + payout_type`.
- Store idempotency key for each transfer.
- Before retry, check whether previous transaction landed.
- Do not blindly resend after RPC timeout.

### 8. Refund Double-Send

Threat:

- Player calls refund endpoint repeatedly or retries after timeout.

Mitigation:

- Unique refund row by `room_id + wallet_address`.
- Refund statuses: `pending`, `sent`, `confirmed`, `failed`, `manual_review`.
- Before retry, inspect existing refund signature.

### 9. Server Wallet Compromise

Threat:

- Vault authority is stolen and used to drain the vault.

Mitigation:

Minimum V1 controls:

- Keep stake caps small.
- Keep token rooms disabled by default.
- Store key in secret manager, not repo.
- Separate vault authority from app deploy key.
- Monitor vault balance changes.
- Emergency pause token rooms.
- Daily payout limits for beta.

Better controls:

- KMS/signer service.
- Program-owned escrow.
- Multisig treasury for fees.
- Manual approval for large transfers.

### 10. Malicious Room State

Threat:

- Backend/Colyseus state diverges or room is finalized with wrong participants.

Mitigation:

- Backend finalization compares result players against confirmed-deposit players.
- Payout only includes wallets with confirmed deposits.
- Unknown wallets in result are rejected.
- Missing deposited players are marked DNF/disconnected, not ignored silently.

### 11. RPC Inconsistency / Outage

Threat:

- RPC says transaction not found, then later finds it; or payout status is ambiguous.

Mitigation:

- Use reliable paid RPC for mainnet beta.
- Use commitment policy consistently (`confirmed` or `finalized`).
- Store ambiguous tx state as `pending_confirmation` or `manual_review`.
- Retry read-only confirmation; do not retry sends blindly.

### 12. Race Result Manipulation

Threat:

- Client hacks movement/checkpoint/finish events to win token room.

Mitigation:

Before token rooms:

- Strong checkpoint proximity validation.
- Class-calibrated speed caps.
- Teleport detection.
- Durable anti-cheat logs.
- Finish plausibility checks.
- No payout if suspicious events exceed threshold.
- Manual review mode.

### 13. Collusion

Threat:

- Players join rooms together and intentionally DNF/feed wins, farm the weekly token stake reward pool, or manipulate room outcomes.

Mitigation:

- Creator fee removed entirely for V1.
- Weekly token stake reward pool requires admin review before manual payout.
- Track repeated wallet clusters.
- Track win rate, shared rooms, DQ/DNF patterns.
- Cap stake amounts in beta.
- Manual review for abnormal patterns.

### 14. Bot Farming

Threat:

- Bots create many low-stake rooms or attempt to farm weekly token stake rewards.

Mitigation:

- Do not implement creator fees in V1.
- Do not auto-distribute weekly token stake rewards in V1.
- Rate-limit room creation and joins.
- Require wallet age/balance heuristics if needed.
- Add allowlist for token-room beta.

### 15. Manual Transfer Confusion

Threat:

- User sends tokens directly to vault without join intent and expects room entry.

Mitigation:

- UI must only support generated deposit transactions.
- Backend should not auto-credit unmatched transfers.
- Support/admin process may manually reconcile, but not automatic room admission.

## Anti-Cheat Launch Gates

Token stake rooms must not go live on mainnet until:

- Normal multiplayer telemetry confirms current anti-cheat does not false-DQ legitimate users.
- Server-side checkpoint coordinates match the live track exactly.
- Movement thresholds are calibrated by car class and network conditions.
- DQ events include reason and player timeline.
- Out-of-order checkpoint attempts are durably logged.
- Repeated suspicious movement blocks token payout.
- Race timeout and disconnect rules are tested.
- Manual review path exists and is operational.

Recommended payout safety states:

- `eligible_for_payout`: clean result, can pay automatically.
- `manual_review`: suspicious or ambiguous; no automatic payout.
- `refund_pending`: pre-start cancellation or never-filled room.
- `payout_failed`: automatic payout attempted but failed.

## Token Room Lifecycle Security

### Created

- Room exists but no deposits accepted until stake preset and max players are valid.
- Creator cannot change stake after creation.

### Depositing

- Join intents can be issued.
- Deposits can be confirmed.
- Room expires if it does not fill in time.

### Locked

- Min players reached and start is pending.
- No new deposits.
- Refunds blocked unless room cancels before start.

### Racing

- Race started.
- Player disconnects become DNF/disconnected.
- Refunds blocked until result/manual review.

### Finalizing

- Backend verifies signed Colyseus result.
- Payout plan computed.
- Any mismatch moves to manual review.

### Paid

- Payout rows and transaction signatures recorded.
- Room closed.

### Refund Pending / Refunded

- Used for pre-start cancellations, expired rooms, or manual review refund decision.

### Manual Review

- Automatic payout blocked.
- Admin/operator decides payout/refund/void after reviewing audit log.

## Payout Policy Matrix

Normal race:

- Valid finishers paid according to split.
- DNF/DQ/disconnected receive 0.
- Fees allocated from actual pool.

Winner DQ:

- DQ receives 0.
- Highest valid finisher becomes top payout recipient.
- Result remains auditable with original placement and DQ reason.

All DNF/DQ:

- Recommended V1: manual review.
- Default should not auto-pay anyone.

Player disconnect before start:

- Refund eligible after timeout/cancel.

Player disconnect after start:

- DNF/disconnected, receives 0 unless manual review decides race was invalid.

Server crash before start:

- Refund eligible.

Server crash after start:

- Manual review unless signed final result was durably stored.

Payout failure:

- Mark payout failed.
- No blind retry.
- Operator/retry worker checks chain state first.

## Weekly Snapshot Security Requirements

Weekly token reward distribution in V1 is manual, but the review data must be frozen and auditable.

Snapshot cadence and scope:

- Create one snapshot every 7 days.
- Recommended week window: Monday 00:00 UTC to next Monday 00:00 UTC.
- Snapshot `weekId` should use ISO week format, e.g. `2026-W26`.
- Snapshot includes only settled Token Stake Rooms from the closed week window.
- Snapshot freezes weekly token pool totals and leaderboard entries at creation time.

Admin-only access:

- Snapshot create/review/record-payout APIs must be admin-only.
- Admin identity should be recorded as `reviewed_by` / `paid_by`.
- Admin actions must be audit logged.
- Client wallets must not be able to trigger, edit, approve, or record weekly payout snapshots.

Per-endpoint security:

- `POST /api/admin/weekly-token-snapshots/create` — requires admin auth; must validate the week is closed (`weekEnd` is in the past); must reject duplicate `weekId`; must compute totals and rankings from settled token room data only, never from live mutable queries; starts snapshot as `pending_review`.
- `GET /api/admin/weekly-token-snapshots` — admin-only; returns list of snapshots with status, week window, pool totals; never exposes vault authority private keys.
- `GET /api/admin/weekly-token-snapshots/:weekId` — admin-only; returns full snapshot + entries; includes `admin_review_status`, `manual_payout_status`, and `suggested_payout_amount` per entry.
- `PATCH /api/admin/weekly-token-snapshots/:weekId/review` — admin-only; transitions `pending_review` → `reviewed`; sets per-entry `admin_review_status` and `payout_eligible`; DQ/suspicious wallets default to `blocked` or `under_review`; after review, ranking/metrics/pool totals must be immutable (except via dispute).
- `PATCH /api/admin/weekly-token-snapshots/:weekId/record-payout` — admin-only; records `manual_payout_signature` after admin manually sends RACETE from `TOKEN_WEEKLY_REWARD_WALLET`; must NOT initiate an on-chain transaction; must validate signature format, token mint, amount, and recipient wallet; updates `manual_payout_status` to `paid`; transitions snapshot to `paid` when all eligible entries are paid.

Eligibility defaults:

- DQ/disqualified players default to `blocked` or `under_review`.
- Suspicious players default to `under_review`.
- Players with unresolved payout/refund disputes should default to `under_review`.
- Final review should explicitly mark each top entry as `unpaid`, `paid`, `blocked`, or `under_review`.

Immutability:

- After final review, snapshot rankings, week window, token mint, weekly pool amount, total token room volume, and leaderboard metrics must not be recomputed silently.
- After final review, only admin notes and manual payout transaction signatures may be appended/updated.
- If a snapshot is disputed after review, create an audit trail entry and move status to `disputed`; do not overwrite historical ranking data.

Manual payout safety:

- Weekly token rewards are paid manually from `TOKEN_WEEKLY_REWARD_WALLET`.
- V1 must not send automatic weekly leaderboard payouts.
- Recording a payout signature must not itself initiate an on-chain transaction.
- Manual payout records should validate token mint, amount, wallet address, and transaction signature format before saving.

Snapshot audit fields should include:

- `weekId`, `weekStart`, `weekEnd`, `snapshotCreatedAt`
- `tokenMint`
- `weeklyRewardWalletAddress`
- `treasuryWalletAddress`
- `totalWeeklyTokenStakeRewardPoolAmount`
- `totalTokenRoomsCount`
- `totalTokenRoomVolume`
- leaderboard category and ranking basis
- entry metrics: wins, races, valid finishes, DNF/DQ counts, suspicious event count, stake volume, gross winnings, total staked, net PnL, best time, win rate
- admin status and manual payout signature

## Audit Log Requirements

Every important event must be inserted into `token_room_events`:

- room created
- join intent created
- deposit submitted
- deposit confirmed/rejected
- player admitted to Colyseus
- room locked
- race started
- checkpoint/movement AC violation summary
- player DQ/DNF/disconnect
- final result received
- finalization accepted/rejected
- payout plan computed
- payout transaction sent/confirmed/failed
- refund requested/sent/confirmed/failed
- manual review opened/resolved
- weekly token snapshot created/reviewed/disputed
- weekly manual payout recorded
- emergency pause triggered

Audit records must include:

- `room_id`
- `race_id` if available
- `wallet_address` if user-specific
- event type
- structured JSON payload
- timestamp

Do not log:

- private keys
- secret env values
- raw HMAC secrets
- unnecessary signed payload signatures

## Operational Safety

Minimum mainnet beta controls:

- `TOKEN_ROOMS_ENABLED=false` by default.
- Separate `TOKEN_ROOMS_MAINNET_ENABLED=false` gate.
- Allowlist wallets initially.
- Start with only 1,000 RACETE stake rooms.
- Daily max room pool cap.
- Daily max payout cap.
- Emergency pause switch.
- Manual review admin path.
- Weekly token stake reward review path; manual payout only.
- Vault balance monitor.
- Payout/refund reconciliation job.

## Security Review Checklist Before Coding

- Custody model approved.
- Fee wallets and vault authority chosen.
- Token mint confirmed.
- RPC provider selected.
- Commitment policy selected.
- DB schema reviewed.
- Finalization HMAC payload reviewed.
- Anti-cheat gates reviewed.
- Manual review process assigned to real operator.
- Weekly token stake reward review/manual distribution process assigned to real operator.
- Emergency pause procedure documented.
- Mainnet beta cap selected.

## Security Review Checklist Before Mainnet Beta

- Deposit verification tested with wrong mint, wrong amount, wrong source, wrong destination, duplicate signature.
- Payout idempotency tested with repeated finalize calls.
- Refund idempotency tested with repeated refund calls.
- RPC timeout and ambiguous status tested.
- Server crash before start tested.
- Server crash after start tested.
- DQ winner tested.
- All DQ/DNF tested.
- Vault reconciliation tested.
- No secrets exposed in frontend bundle or logs.
- Token rooms still behind feature flags.
