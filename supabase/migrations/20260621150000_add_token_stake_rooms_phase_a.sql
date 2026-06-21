-- Token Stake Rooms Phase A foundation.
-- Creates schema only. Does not enable token rooms, deposits, payouts, or on-chain logic.

create extension if not exists "pgcrypto";

create table if not exists token_rooms (
  id uuid primary key default gen_random_uuid(),
  room_id text not null unique,
  race_id text unique,
  server_room_id text,
  server_race_id text,
  token_mint text not null,
  stake_amount numeric(38,0) not null,
  stake_decimals integer not null default 6,
  stake_preset text not null check (stake_preset in ('1000','5000','10000','25000')),
  creator_wallet_address text not null references players(wallet_address) on delete restrict,
  min_players integer not null default 2,
  max_players integer not null,
  confirmed_player_count integer not null default 0,
  status text not null default 'created' check (
    status in (
      'created','depositing','locked','racing','finalizing','manual_review',
      'payout_pending','paid','refund_pending','refunded','cancelled','expired','payout_failed'
    )
  ),
  vault_token_account text,
  vault_authority_type text not null default 'server_wallet' check (vault_authority_type in ('server_wallet','program_escrow','manual')),
  creator_fee_bps integer not null default 0,
  weekly_reward_bps integer not null default 1500,
  treasury_fee_bps integer not null default 500,
  player_payout_bps integer not null default 8000,
  confirmed_pool_amount numeric(38,0) not null default 0,
  weekly_reward_amount numeric(38,0) not null default 0,
  treasury_fee_amount numeric(38,0) not null default 0,
  player_payout_pool_amount numeric(38,0) not null default 0,
  payout_total_amount numeric(38,0) not null default 0,
  refund_total_amount numeric(38,0) not null default 0,
  result_hash text,
  finalize_signature_hash text,
  anti_cheat_summary jsonb not null default '{}'::jsonb,
  manual_review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  locked_at timestamptz,
  started_at timestamptz,
  finalized_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  cancelled_at timestamptz,
  check (stake_amount > 0),
  check (min_players >= 2),
  check (max_players between 2 and 6),
  check (min_players <= max_players),
  check (creator_fee_bps + weekly_reward_bps + treasury_fee_bps + player_payout_bps = 10000),
  check (confirmed_pool_amount >= 0),
  check (weekly_reward_amount >= 0),
  check (treasury_fee_amount >= 0),
  check (player_payout_pool_amount >= 0),
  check (payout_total_amount >= 0),
  check (refund_total_amount >= 0)
);

create table if not exists token_deposits (
  id uuid primary key default gen_random_uuid(),
  join_intent_id uuid,
  room_id text not null references token_rooms(room_id) on delete cascade,
  wallet_address text not null references players(wallet_address) on delete restrict,
  token_mint text not null,
  stake_amount numeric(38,0) not null,
  source_token_account text,
  destination_token_account text,
  vault_token_account text,
  deposit_signature text,
  signature_status text,
  slot bigint,
  block_time timestamptz,
  confirmation_level text,
  status text not null default 'intent_created' check (
    status in ('intent_created','signature_submitted','confirmed','rejected','expired','refunded','manual_review')
  ),
  verification_error text,
  raw_verification jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  expires_at timestamptz not null,
  check (stake_amount > 0)
);

create table if not exists token_room_players (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references token_rooms(room_id) on delete cascade,
  race_id text,
  wallet_address text not null references players(wallet_address) on delete restrict,
  is_creator boolean not null default false,
  status text not null default 'joining' check (
    status in (
      'invited','joining','deposit_pending','deposit_confirmed','ready','racing',
      'finished','dnf','disconnected','disqualified','refunded','manual_review'
    )
  ),
  deposit_status text not null default 'intent_created' check (
    deposit_status in ('intent_created','signature_submitted','confirmed','rejected','expired','refunded','manual_review')
  ),
  deposit_id uuid references token_deposits(id) on delete set null,
  stake_amount numeric(38,0) not null,
  token_mint text not null,
  placement integer,
  eligible_for_payout boolean not null default false,
  payout_rank integer,
  payout_amount numeric(38,0) not null default 0,
  refund_amount numeric(38,0) not null default 0,
  final_race_status text check (final_race_status is null or final_race_status in ('finished','dnf','disconnected','disqualified')),
  finish_time_ms integer,
  best_lap_ms integer,
  first_lap_ms integer,
  laps_completed integer not null default 0,
  checkpoints_completed integer not null default 0,
  suspicious_events integer not null default 0,
  speed_violations integer not null default 0,
  teleport_violations integer not null default 0,
  checkpoint_violations integer not null default 0,
  out_of_order_violations integer not null default 0,
  dq_reason text,
  joined_at timestamptz not null default now(),
  deposit_confirmed_at timestamptz,
  ready_at timestamptz,
  finished_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(room_id, wallet_address),
  check (stake_amount > 0),
  check (placement is null or placement between 1 and 6),
  check (payout_rank is null or payout_rank between 1 and 3),
  check (payout_amount >= 0),
  check (refund_amount >= 0)
);

create table if not exists token_payouts (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references token_rooms(room_id) on delete cascade,
  race_id text,
  wallet_address text references players(wallet_address) on delete restrict,
  recipient_wallet_address text not null,
  token_mint text not null,
  amount numeric(38,0) not null,
  payout_type text not null check (payout_type in ('player','weekly_reward_pool','treasury_fee','manual_adjustment')),
  placement integer,
  payout_rank integer,
  status text not null default 'planned' check (status in ('planned','pending','sent','confirmed','failed','cancelled','manual_review')),
  idempotency_key text not null unique,
  payout_signature text,
  signature_status text,
  slot bigint,
  block_time timestamptz,
  failure_reason text,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  planned_at timestamptz not null default now(),
  sent_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  check (amount >= 0),
  check (placement is null or placement between 1 and 6),
  check (payout_rank is null or payout_rank between 1 and 3)
);

create table if not exists token_refunds (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references token_rooms(room_id) on delete cascade,
  wallet_address text not null references players(wallet_address) on delete restrict,
  deposit_id uuid references token_deposits(id) on delete set null,
  token_mint text not null,
  amount numeric(38,0) not null,
  reason text not null check (reason in ('room_expired','room_cancelled','server_crash_before_start','manual_review_refund','admin_void')),
  status text not null default 'requested' check (status in ('requested','pending','sent','confirmed','failed','rejected','manual_review')),
  idempotency_key text not null unique,
  refund_signature text,
  signature_status text,
  slot bigint,
  block_time timestamptz,
  failure_reason text,
  retry_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  unique(room_id, wallet_address),
  check (amount >= 0)
);

create table if not exists token_room_events (
  id uuid primary key default gen_random_uuid(),
  room_id text references token_rooms(room_id) on delete cascade,
  race_id text,
  wallet_address text,
  event_type text not null,
  event_source text not null check (event_source in ('client_api','server_api','colyseus','solana_rpc','admin','cron')),
  severity text not null default 'info' check (severity in ('debug','info','warning','error','critical')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists weekly_token_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_id text not null unique,
  week_start timestamptz not null,
  week_end timestamptz not null,
  token_mint text not null,
  weekly_reward_wallet text not null,
  snapshot_status text not null default 'pending' check (
    snapshot_status in ('pending','under_review','approved','manual_payout_in_progress','paid','void')
  ),
  total_weekly_pool_amount numeric(38,0) not null default 0,
  total_token_room_count integer not null default 0,
  total_token_volume numeric(38,0) not null default 0,
  eligible_player_count integer not null default 0,
  blocked_player_count integer not null default 0,
  snapshot_hash text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  check (week_end > week_start),
  check (total_weekly_pool_amount >= 0),
  check (total_token_room_count >= 0),
  check (total_token_volume >= 0),
  check (eligible_player_count >= 0),
  check (blocked_player_count >= 0)
);

create table if not exists weekly_token_snapshot_entries (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references weekly_token_snapshots(id) on delete cascade,
  wallet_address text not null references players(wallet_address) on delete restrict,
  rank integer not null,
  token_room_wins integer not null default 0,
  token_room_podiums integer not null default 0,
  token_rooms_finished integer not null default 0,
  token_rooms_entered integer not null default 0,
  token_room_win_rate numeric not null default 0,
  net_token_profit numeric(38,0) not null default 0,
  gross_token_won numeric(38,0) not null default 0,
  gross_token_staked numeric(38,0) not null default 0,
  suspicious_event_count integer not null default 0,
  disqualification_count integer not null default 0,
  payout_eligible boolean not null default false,
  suggested_payout_amount numeric(38,0) not null default 0,
  manual_payout_status text not null default 'pending' check (
    manual_payout_status in ('not_required','pending','sent','confirmed','blocked','under_review')
  ),
  manual_payout_signature text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(snapshot_id, wallet_address),
  unique(snapshot_id, rank),
  check (rank > 0),
  check (token_room_wins >= 0),
  check (token_room_podiums >= 0),
  check (token_rooms_finished >= 0),
  check (token_rooms_entered >= 0),
  check (token_room_win_rate >= 0),
  check (suspicious_event_count >= 0),
  check (disqualification_count >= 0),
  check (suggested_payout_amount >= 0)
);

create table if not exists weekly_token_manual_payouts (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references weekly_token_snapshots(id) on delete cascade,
  snapshot_entry_id uuid references weekly_token_snapshot_entries(id) on delete set null,
  week_id text not null,
  wallet_address text not null references players(wallet_address) on delete restrict,
  token_mint text not null,
  amount numeric(38,0) not null,
  status text not null default 'pending' check (status in ('pending','sent','confirmed','failed','blocked','void')),
  manual_payout_signature text,
  signature_status text,
  slot bigint,
  block_time timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  unique(snapshot_id, wallet_address),
  check (amount >= 0)
);

create index if not exists token_rooms_status_expires_idx on token_rooms(status, expires_at);
create index if not exists token_rooms_creator_created_idx on token_rooms(creator_wallet_address, created_at desc);
create index if not exists token_rooms_token_status_idx on token_rooms(token_mint, status);
create index if not exists token_rooms_race_id_idx on token_rooms(race_id);
create index if not exists token_rooms_server_race_id_idx on token_rooms(server_race_id);

create index if not exists token_deposits_room_status_idx on token_deposits(room_id, status);
create index if not exists token_deposits_wallet_created_idx on token_deposits(wallet_address, created_at desc);
create index if not exists token_deposits_expires_status_idx on token_deposits(expires_at, status);
create unique index if not exists token_deposits_signature_unique_idx on token_deposits(deposit_signature) where deposit_signature is not null;

create index if not exists token_room_players_wallet_created_idx on token_room_players(wallet_address, created_at desc);
create index if not exists token_room_players_room_status_idx on token_room_players(room_id, status);
create index if not exists token_room_players_room_payout_idx on token_room_players(room_id, eligible_for_payout);
create index if not exists token_room_players_race_id_idx on token_room_players(race_id);

create index if not exists token_payouts_room_type_idx on token_payouts(room_id, payout_type);
create index if not exists token_payouts_recipient_created_idx on token_payouts(recipient_wallet_address, created_at desc);
create index if not exists token_payouts_status_created_idx on token_payouts(status, created_at);
create unique index if not exists token_payouts_signature_unique_idx on token_payouts(payout_signature) where payout_signature is not null;
create unique index if not exists token_payouts_room_recipient_type_rank_unique_idx
  on token_payouts(room_id, recipient_wallet_address, payout_type, payout_rank)
  where payout_rank is not null;

create index if not exists token_refunds_room_status_idx on token_refunds(room_id, status);
create index if not exists token_refunds_wallet_created_idx on token_refunds(wallet_address, created_at desc);
create index if not exists token_refunds_status_created_idx on token_refunds(status, created_at);
create unique index if not exists token_refunds_signature_unique_idx on token_refunds(refund_signature) where refund_signature is not null;

create index if not exists token_room_events_room_created_idx on token_room_events(room_id, created_at desc);
create index if not exists token_room_events_race_created_idx on token_room_events(race_id, created_at desc);
create index if not exists token_room_events_wallet_created_idx on token_room_events(wallet_address, created_at desc);
create index if not exists token_room_events_type_created_idx on token_room_events(event_type, created_at desc);
create index if not exists token_room_events_severity_created_idx on token_room_events(severity, created_at desc);

create index if not exists weekly_token_snapshots_status_week_idx on weekly_token_snapshots(snapshot_status, week_start desc);
create index if not exists weekly_token_snapshots_token_week_idx on weekly_token_snapshots(token_mint, week_start desc);
create index if not exists weekly_token_snapshot_entries_snapshot_rank_idx on weekly_token_snapshot_entries(snapshot_id, rank);
create index if not exists weekly_token_snapshot_entries_wallet_created_idx on weekly_token_snapshot_entries(wallet_address, created_at desc);
create index if not exists weekly_token_snapshot_entries_payout_status_idx on weekly_token_snapshot_entries(snapshot_id, manual_payout_status);
create index if not exists weekly_token_snapshot_entries_eligible_idx on weekly_token_snapshot_entries(snapshot_id, payout_eligible);
create index if not exists weekly_token_manual_payouts_week_status_idx on weekly_token_manual_payouts(week_id, status);
create index if not exists weekly_token_manual_payouts_wallet_created_idx on weekly_token_manual_payouts(wallet_address, created_at desc);
create unique index if not exists weekly_token_manual_payouts_signature_unique_idx on weekly_token_manual_payouts(manual_payout_signature) where manual_payout_signature is not null;

alter table token_rooms enable row level security;
alter table token_room_players enable row level security;
alter table token_deposits enable row level security;
alter table token_payouts enable row level security;
alter table token_refunds enable row level security;
alter table token_room_events enable row level security;
alter table weekly_token_snapshots enable row level security;
alter table weekly_token_snapshot_entries enable row level security;
alter table weekly_token_manual_payouts enable row level security;

-- RLS policy intentionally conservative for Phase A:
-- no public anon/auth policies are created. Service-role backend APIs can access these tables.
