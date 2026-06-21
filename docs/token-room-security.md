# Token Stake Rooms V1 — Security Spec

Status: **Security design only — not implemented, not enabled**

Token placeholder:

```env
RACETE_TOKEN_MINT=TO_BE_PROVIDED_PUMPFUN_MINT
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
RACETE_TOKEN_MINT=TO_BE_PROVIDED_PUMPFUN_MINT
SOLANA_RPC_URL=...
TOKEN_ROOM_SECRET=...
TOKEN_VAULT_AUTHORITY=...
TOKEN_TREASURY_WALLET=...
TOKEN_WEEKLY_REWARD_WALLET=...
TOKEN_ROOMS_ENABLED=false
TOKEN_ROOMS_MAINNET_ENABLED=false
```

Existing multiplayer reward secret remains separate:

```env
MULTIPLAYER_REWARD_SECRET=...
```

Rules:

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
