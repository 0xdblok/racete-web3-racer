# Token Stake Rooms V1 — Proposed DB Schema

Status: **Schema proposal only — no migration created yet**

Token mint configuration:

```env
# Temporary dev/test token mint only. Do not use as final production Pump.fun token.
RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump

# Final production Pump.fun token mint. Still pending and must remain a placeholder until provided.
RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT
```

This document proposes the database tables needed for Token Stake Rooms V1. It is intentionally written as a schema specification, not an executable migration.

## Design Goals

- Track rooms, players, deposits, payouts, refunds, and audit events separately.
- Make every money movement idempotent.
- Store token mint explicitly on every room/deposit/payout/refund row for auditability.
- Dev/test rows may use `RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump`; production/mainnet rows must use `RACETE_TOKEN_MINT` only after the final Pump.fun mint is provided.
- Keep Race Cash tables separate from token stake accounting.
- Avoid mixing free multiplayer rewards with token-room stake payouts.
- Support manual review, refund, and failed payout workflows.
- Preserve enough data to reconcile DB accounting against on-chain vault activity.

## Naming

Recommended tables:

- `token_rooms`
- `token_room_players`
- `token_deposits`
- `token_payouts`
- `token_refunds`
- `token_room_events`

Optional future tables:

- `token_room_join_intents`
- `token_room_payout_plans`
- `token_room_admin_reviews`
- `token_room_wallet_risk_scores`
- `weekly_token_snapshots`
- `weekly_token_snapshot_entries`
- `weekly_token_manual_payouts`

## Status Enums

These can be implemented as text `check` constraints for V1 rather than Postgres enum types, to keep migrations easier to evolve.

### `token_rooms.status`

Allowed values:

- `created`
- `depositing`
- `locked`
- `racing`
- `finalizing`
- `manual_review`
- `payout_pending`
- `paid`
- `refund_pending`
- `refunded`
- `cancelled`
- `expired`
- `payout_failed`

### `token_room_players.status`

Allowed values:

- `invited`
- `joining`
- `deposit_pending`
- `deposit_confirmed`
- `ready`
- `racing`
- `finished`
- `dnf`
- `disconnected`
- `disqualified`
- `refunded`
- `manual_review`

### `token_deposits.status`

Allowed values:

- `intent_created`
- `signature_submitted`
- `confirmed`
- `rejected`
- `expired`
- `refunded`
- `manual_review`

### `token_payouts.status`

Allowed values:

- `planned`
- `pending`
- `sent`
- `confirmed`
- `failed`
- `cancelled`
- `manual_review`

### `token_refunds.status`

Allowed values:

- `requested`
- `pending`
- `sent`
- `confirmed`
- `failed`
- `rejected`
- `manual_review`

### `weekly_token_snapshots.snapshot_status`

Allowed values:

- `pending_review`
- `reviewed`
- `paid`
- `disputed`

### `weekly_token_snapshot_entries.manual_payout_status`

Allowed values:

- `unpaid`
- `paid`
- `blocked`
- `under_review`

## Table: `token_rooms`

Purpose: canonical room lifecycle and pool accounting.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
room_id text not null unique
race_id text unique
server_room_id text
server_race_id text
token_mint text not null
stake_amount numeric not null
stake_decimals integer not null default 6
stake_preset text not null
creator_wallet_address text not null references players(wallet_address) on delete restrict
min_players integer not null default 2
max_players integer not null
confirmed_player_count integer not null default 0
status text not null
vault_token_account text not null
vault_authority_type text not null default 'server_wallet'
treasury_wallet_address text not null
weekly_reward_wallet_address text not null
creator_fee_bps integer not null default 0
weekly_token_stake_reward_pool_bps integer not null default 1500
treasury_fee_bps integer not null default 500
player_payout_pool_bps integer not null default 8000
confirmed_pool_amount numeric not null default 0
weekly_token_stake_reward_pool_amount numeric not null default 0
treasury_fee_amount numeric not null default 0
player_payout_pool_amount numeric not null default 0
payout_total_amount numeric not null default 0
refund_total_amount numeric not null default 0
result_hash text
finalize_signature_hash text
anti_cheat_summary jsonb not null default '{}'::jsonb
manual_review_reason text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
expires_at timestamptz not null
locked_at timestamptz
started_at timestamptz
finalized_at timestamptz
paid_at timestamptz
refunded_at timestamptz
cancelled_at timestamptz
```

Recommended constraints:

```sql
check (stake_amount > 0)
check (min_players >= 2)
check (max_players between 2 and 6)
check (min_players <= max_players)
check (creator_fee_bps = 0)
check (creator_fee_bps + weekly_token_stake_reward_pool_bps + treasury_fee_bps + player_payout_pool_bps = 10000)
check (status in (...))
```

Recommended indexes:

```sql
create index on token_rooms(status, expires_at);
create index on token_rooms(creator_wallet_address, created_at desc);
create index on token_rooms(token_mint, status);
create index on token_rooms(race_id);
create index on token_rooms(server_race_id);
```

Notes:

- `stake_amount` should be stored in base token units, not UI decimals.
- `stake_preset` should be one of `1000`, `5000`, `10000`, `25000` RACETE in display units.
- `treasury_wallet_address` should mirror `TOKEN_TREASURY_WALLET` at room creation time for auditability.
- `weekly_reward_wallet_address` should mirror `TOKEN_WEEKLY_REWARD_WALLET` at room creation time for auditability.
- `creator_fee_bps` is fixed at `0` for V1; do not implement creator fee payout logic.
- `weekly_token_stake_reward_pool_amount` is transferred automatically to the weekly reward wallet during race settlement and tracked for admin-reviewed/manual weekly token reward distribution only.
- `finalize_signature_hash` stores a hash/fingerprint, not necessarily the raw HMAC signature.
- `anti_cheat_summary` stores final AC counts, DQ reasons, and confidence.

## Table: `token_room_players`

Purpose: one row per wallet participating in a room.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
room_id text not null references token_rooms(room_id) on delete cascade
race_id text
wallet_address text not null references players(wallet_address) on delete restrict
is_creator boolean not null default false
status text not null
deposit_status text not null default 'intent_created'
deposit_id uuid references token_deposits(id) on delete set null
stake_amount numeric not null
token_mint text not null
placement integer
eligible_for_payout boolean not null default false
payout_rank integer
payout_amount numeric not null default 0
refund_amount numeric not null default 0
final_race_status text
finish_time_ms integer
best_lap_ms integer
first_lap_ms integer
laps_completed integer not null default 0
checkpoints_completed integer not null default 0
suspicious_events integer not null default 0
speed_violations integer not null default 0
teleport_violations integer not null default 0
checkpoint_violations integer not null default 0
out_of_order_violations integer not null default 0
dq_reason text
joined_at timestamptz not null default now()
deposit_confirmed_at timestamptz
ready_at timestamptz
finished_at timestamptz
left_at timestamptz
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```sql
unique(room_id, wallet_address)
check (stake_amount > 0)
check (placement is null or placement between 1 and 6)
check (payout_rank is null or payout_rank between 1 and 3)
check (status in (...))
```

Recommended indexes:

```sql
create index on token_room_players(wallet_address, created_at desc);
create index on token_room_players(room_id, status);
create index on token_room_players(room_id, eligible_for_payout);
create index on token_room_players(race_id);
```

Notes:

- `payout_rank` may differ from original placement when higher-placed players are DQ.
- DQ/DNF/disconnected players should have `eligible_for_payout=false` and `payout_amount=0`.

## Table: `token_deposits`

Purpose: on-chain deposit verification record.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
join_intent_id uuid
room_id text not null references token_rooms(room_id) on delete cascade
wallet_address text not null references players(wallet_address) on delete restrict
token_mint text not null
stake_amount numeric not null
source_token_account text
destination_token_account text not null
vault_token_account text not null
deposit_signature text unique
signature_status text
slot bigint
block_time timestamptz
confirmation_level text
status text not null default 'intent_created'
verification_error text
raw_verification jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
submitted_at timestamptz
confirmed_at timestamptz
expires_at timestamptz not null
```

Recommended constraints:

```sql
check (stake_amount > 0)
check (status in (...))
```

Recommended indexes:

```sql
create index on token_deposits(room_id, status);
create index on token_deposits(wallet_address, created_at desc);
create unique index token_deposits_signature_unique
  on token_deposits(deposit_signature)
  where deposit_signature is not null;
create index on token_deposits(expires_at, status);
```

Notes:

- A signature can only be used once globally.
- `raw_verification` can include sanitized instruction metadata and RPC commitment data.
- Do not store private keys or secret material.

## Optional Table: `token_room_join_intents`

Purpose: explicit one-time deposit instruction record.

This is optional but recommended because it separates intent creation from on-chain confirmation.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
room_id text not null references token_rooms(room_id) on delete cascade
wallet_address text not null references players(wallet_address) on delete restrict
token_mint text not null
stake_amount numeric not null
vault_token_account text not null
memo_reference text unique
status text not null default 'created'
created_at timestamptz not null default now()
expires_at timestamptz not null
consumed_at timestamptz
```

Allowed statuses:

- `created`
- `consumed`
- `expired`
- `cancelled`

Recommended constraints:

```sql
unique(room_id, wallet_address, status) -- if implemented via partial unique index for active intents
```

## Table: `token_payouts`

Purpose: one row per planned/sent/confirmed token transfer from room pool.

Payout types:

- `winner`
- `weekly_token_stake_reward_pool`
- `treasury_fee`
- `manual_adjustment`

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
room_id text not null references token_rooms(room_id) on delete cascade
race_id text
wallet_address text
recipient_wallet_address text not null
token_mint text not null
amount numeric not null
payout_type text not null
placement integer
payout_rank integer
status text not null default 'planned'
idempotency_key text not null unique
payout_signature text unique
signature_status text
slot bigint
block_time timestamptz
failure_reason text
retry_count integer not null default 0
metadata jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
planned_at timestamptz not null default now()
sent_at timestamptz
confirmed_at timestamptz
failed_at timestamptz
```

Recommended constraints:

```sql
check (amount >= 0)
check (payout_type in ('winner', 'weekly_token_stake_reward_pool', 'treasury_fee', 'manual_adjustment'))
check (status in (...))
```

Recommended indexes:

```sql
create index on token_payouts(room_id, payout_type);
create index on token_payouts(recipient_wallet_address, created_at desc);
create index on token_payouts(status, created_at);
create unique index token_payouts_signature_unique
  on token_payouts(payout_signature)
  where payout_signature is not null;
```

Recommended uniqueness:

```sql
unique(room_id, recipient_wallet_address, payout_type, payout_rank)
```

Notes:

- `wallet_address` is the player wallet when payout is related to a participant.
- `recipient_wallet_address` may be a player winner wallet, treasury wallet, or weekly token stake reward pool wallet.
- Creator fee payouts are intentionally excluded from V1.
- Weekly token stake reward pool transfers fund the weekly pool only; weekly player rewards are admin-reviewed/manual-payout in V1.
- Retry must inspect whether `payout_signature` already landed before sending again.

## Table: `token_refunds`

Purpose: one row per refund to a player.

Refund reasons:

- `room_expired`
- `room_cancelled`
- `server_crash_before_start`
- `manual_review_refund`
- `admin_void`

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
room_id text not null references token_rooms(room_id) on delete cascade
wallet_address text not null references players(wallet_address) on delete restrict
deposit_id uuid references token_deposits(id) on delete set null
token_mint text not null
amount numeric not null
reason text not null
status text not null default 'requested'
idempotency_key text not null unique
refund_signature text unique
signature_status text
slot bigint
block_time timestamptz
failure_reason text
retry_count integer not null default 0
metadata jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
requested_at timestamptz not null default now()
sent_at timestamptz
confirmed_at timestamptz
failed_at timestamptz
```

Recommended constraints:

```sql
unique(room_id, wallet_address)
check (amount >= 0)
check (status in (...))
```

Recommended indexes:

```sql
create index on token_refunds(room_id, status);
create index on token_refunds(wallet_address, created_at desc);
create index on token_refunds(status, created_at);
create unique index token_refunds_signature_unique
  on token_refunds(refund_signature)
  where refund_signature is not null;
```

## Table: `token_room_events`

Purpose: immutable audit/event log.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
room_id text references token_rooms(room_id) on delete cascade
race_id text
wallet_address text
event_type text not null
event_source text not null
severity text not null default 'info'
payload jsonb not null default '{}'::jsonb
created_at timestamptz not null default now()
```

Allowed `event_source` values:

- `client_api`
- `server_api`
- `colyseus`
- `solana_rpc`
- `admin`
- `cron`

Allowed `severity` values:

- `debug`
- `info`
- `warning`
- `error`
- `critical`

Recommended indexes:

```sql
create index on token_room_events(room_id, created_at desc);
create index on token_room_events(race_id, created_at desc);
create index on token_room_events(wallet_address, created_at desc);
create index on token_room_events(event_type, created_at desc);
create index on token_room_events(severity, created_at desc);
```

Notes:

- Treat event log as append-only.
- Do not store secrets in payload.
- Redact raw signatures if not needed; transaction signatures are public and can be stored.
- Store anti-cheat summaries and reason codes here.

## Optional Table: `token_room_payout_plans`

Purpose: snapshot exact payout math before sending transactions.

Useful for manual review and idempotency.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
room_id text not null references token_rooms(room_id) on delete cascade
race_id text
plan_hash text not null unique
confirmed_pool_amount numeric not null
weekly_token_stake_reward_pool_amount numeric not null default 0
treasury_fee_amount numeric not null default 0
player_payout_pool_amount numeric not null default 0
plan jsonb not null
status text not null default 'planned'
created_at timestamptz not null default now()
approved_at timestamptz
executed_at timestamptz
```

Allowed statuses:

- `planned`
- `approved`
- `executing`
- `executed`
- `cancelled`
- `manual_review`

## Table: `weekly_token_snapshots`

Purpose: frozen weekly leaderboard and weekly reward-pool snapshot used for manual weekly token reward distribution.

V1 note: this is a future schema proposal only. Do not create the migration until implementation is approved.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
week_id text not null unique
week_start timestamptz not null
week_end timestamptz not null
token_mint text not null
weekly_reward_wallet_address text not null
treasury_wallet_address text not null
total_weekly_token_pool_amount numeric not null default 0
total_token_room_volume numeric not null default 0
total_token_room_count integer not null default 0
leaderboard_category text not null default 'token_room_weekly_composite'
ranking_basis jsonb not null default '{}'::jsonb
snapshot_status text not null default 'pending_review'
created_at timestamptz not null default now()
reviewed_at timestamptz
reviewed_by text
admin_notes text
```

Recommended constraints:

```sql
check (week_end > week_start)
check (total_weekly_token_pool_amount >= 0)
check (total_token_room_volume >= 0)
check (total_token_room_count >= 0)
check (snapshot_status in ('pending_review', 'reviewed', 'paid', 'disputed'))
```

Recommended indexes:

```sql
create index on weekly_token_snapshots(snapshot_status, week_start desc);
create index on weekly_token_snapshots(token_mint, week_start desc);
```

Notes:

- Recommended window is Monday 00:00 UTC to next Monday 00:00 UTC.
- `week_id` should use ISO week format, e.g. `2026-W26`.
- Snapshot must freeze the weekly pool amount and leaderboard inputs at creation/review time.
- After final review, ranking fields should be immutable except via explicit dispute process.

## Table: `weekly_token_snapshot_entries`

Purpose: one frozen leaderboard entry per wallet per weekly snapshot.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
snapshot_id uuid not null references weekly_token_snapshots(id) on delete cascade
wallet_address text not null references players(wallet_address) on delete restrict
rank integer not null
total_token_room_wins integer not null default 0
total_token_room_races integer not null default 0
valid_finishes integer not null default 0
dnf_count integer not null default 0
dq_count integer not null default 0
suspicious_event_count integer not null default 0
total_stake_volume numeric not null default 0
gross_token_winnings numeric not null default 0
total_token_staked numeric not null default 0
net_token_pnl numeric not null default 0
best_time_ms integer
win_rate numeric not null default 0
payout_eligible boolean not null default false
admin_review_status text not null default 'unreviewed'
suggested_payout_amount numeric not null default 0
manual_payout_status text not null default 'unpaid'
manual_payout_signature text
admin_notes text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Recommended constraints:

```sql
unique(snapshot_id, wallet_address)
unique(snapshot_id, rank)
check (rank > 0)
check (total_token_room_wins >= 0)
check (total_token_room_races >= 0)
check (valid_finishes >= 0)
check (dnf_count >= 0)
check (dq_count >= 0)
check (suspicious_event_count >= 0)
check (total_stake_volume >= 0)
check (gross_token_winnings >= 0)
check (total_token_staked >= 0)
check (win_rate >= 0 and win_rate <= 1)
check (admin_review_status in ('unreviewed', 'cleared', 'flagged', 'blocked'))
check (suggested_payout_amount >= 0)
check (manual_payout_status in ('unpaid', 'paid', 'blocked', 'under_review'))
```

Recommended indexes:

```sql
create index on weekly_token_snapshot_entries(snapshot_id, rank);
create index on weekly_token_snapshot_entries(wallet_address, created_at desc);
create index on weekly_token_snapshot_entries(snapshot_id, manual_payout_status);
create index on weekly_token_snapshot_entries(snapshot_id, payout_eligible);
```

Eligibility notes:

- DQ/disqualified wallets should default to `payout_eligible=false` and `manual_payout_status='blocked'` or `under_review`.
- Suspicious wallets should default to `manual_payout_status='under_review'`.
- `suggested_payout_amount` is advisory for admin review; V1 does not auto-send weekly token rewards.
- `manual_payout_signature` records a manually executed transfer, not an automatic payout initiated by the app.

## Table: `weekly_token_manual_payouts`

Purpose: immutable-ish record of admin/manual weekly token reward payouts from `TOKEN_WEEKLY_REWARD_WALLET`.

Proposed columns:

```sql
id uuid primary key default gen_random_uuid()
snapshot_id uuid not null references weekly_token_snapshots(id) on delete cascade
wallet_address text not null references players(wallet_address) on delete restrict
amount numeric not null
token_mint text not null
payout_signature text unique
paid_by text not null
paid_at timestamptz not null default now()
notes text
created_at timestamptz not null default now()
```

Recommended constraints:

```sql
unique(snapshot_id, wallet_address)
check (amount > 0)
```

Recommended indexes:

```sql
create index on weekly_token_manual_payouts(snapshot_id, paid_at desc);
create index on weekly_token_manual_payouts(wallet_address, paid_at desc);
create unique index weekly_token_manual_payouts_signature_unique
  on weekly_token_manual_payouts(payout_signature)
  where payout_signature is not null;
```

Notes:

- This table records manual admin payouts only.
- Inserting a row must not send an on-chain transaction.
- `payout_signature` should be populated after the admin manually sends RACETE.
- `paid_by` should identify the admin/operator account, not the recipient wallet.

## RLS / Service Role Policy

Recommended V1:

- Enable RLS on all token-room tables.
- Public clients should not write directly to these tables.
- All writes go through server API with service role.
- Weekly snapshot create/review/record-payout writes must go through admin-only APIs.
- Final-reviewed snapshot ranking and metric fields should be immutable except through explicit disputed/admin process.
- Read access can be exposed through API endpoints, not direct Supabase client queries.

Potential safe public reads later:

- Available room list with non-sensitive fields.
- User's own deposit/refund/payout status.

Do not expose:

- vault authority details beyond public token account addresses.
- anti-cheat raw timeline for other players.
- admin review internals.

## Accounting Invariants

These invariants should be enforced in service code and checked in reconciliation jobs:

```text
confirmed_pool_amount = sum(confirmed token_deposits.amount for room)
```

```text
payout_total_amount = sum(confirmed token_payouts.amount for room)
```

```text
refund_total_amount = sum(confirmed token_refunds.amount for room)
```

```text
payout_total_amount + refund_total_amount <= confirmed_pool_amount
```

```text
Every token_room_player with status deposit_confirmed has exactly one confirmed token_deposit.
```

```text
Every token_payout and token_refund has an idempotency_key.
```

```text
No room can transition paid/refunded without corresponding confirmed transfer rows.
```

```text
weekly_token_snapshots.total_weekly_token_pool_amount = sum(confirmed weekly token stake reward pool transfers for settled rooms in [week_start, week_end))
```

```text
weekly_token_snapshot_entries are ranked from frozen settled room results, not live mutable leaderboard queries after review.
```

```text
weekly_token_manual_payouts records must not initiate on-chain payouts; they only record admin/manual transfers already sent from TOKEN_WEEKLY_REWARD_WALLET.
```

## Example Payout Calculation Fields

For a room with 6 players staking 10,000 RACETE each:

```text
confirmedPool = 60,000 RACETE
creatorFee = 0 RACETE (0%)
weeklyTokenStakeRewardPool = 9,000 RACETE (15%)
treasuryFee = 3,000 RACETE (5%)
playerPayoutPool = 48,000 RACETE (80%)
```

With 3+ valid finishers:

```text
1st = 31,200 RACETE (65% of playerPayoutPool)
2nd = 12,000 RACETE (25% of playerPayoutPool)
3rd = 4,800 RACETE  (10% of playerPayoutPool)
```

Weekly token stake reward pool handling:

- Track the 15% weekly allocation in RACETE.
- Do not auto-distribute weekly rewards in V1.
- Admin manually reviews weekly winners.
- Admin manually sends weekly token payouts after review.

## Migration Notes for Later

When this spec becomes an actual migration:

- Use `create table if not exists`.
- Add `updated_at` trigger if project already uses one.
- Add indexes after table creation.
- Enable RLS.
- Do not create automatic payout triggers in DB; payouts must happen in service code with explicit transaction signing.
- Do not create automatic weekly token reward payout triggers; weekly snapshot/manual payout tables are audit records only in V1.
- Do not add references to Race Cash reward tables except maybe audit links. Token accounting must remain separate.

## Open Schema Questions

- Should join intents be a separate table or folded into `token_deposits`?
- Should `race_id` be globally unique across free and token races, or only within token-room tables?
- Should per-room vault token accounts be first-class columns from day one?
- Should payout plans be required before any automatic payout, or only for manual review?
- Should admin review have a separate table with reviewer wallet/admin identity?
- Should weekly snapshots store only top N entries or every eligible wallet for full auditability?
- Should weekly manual payout amount suggestions be fixed rank percentages or decided by admin policy per snapshot?
