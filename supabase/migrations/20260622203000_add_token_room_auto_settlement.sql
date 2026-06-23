-- Token Stake Rooms Phase C.3 automatic settlement + payout ledger hardening.
-- Additive/safe constraint expansion only; no destructive data changes.

alter table token_rooms
  add column if not exists settlement_lock_id text,
  add column if not exists settlement_locked_at timestamptz,
  add column if not exists results_recorded_at timestamptz,
  add column if not exists settlement_calculated_at timestamptz,
  add column if not exists payout_execution_started_at timestamptz,
  add column if not exists settlement_hash text;

alter table token_payouts
  add column if not exists tx_signature text,
  add column if not exists amount_base_units numeric(38,0),
  add column if not exists recipient_wallet text,
  add column if not exists paid_at timestamptz,
  add column if not exists execution_attempts integer not null default 0,
  add column if not exists execution_lock_id text,
  add column if not exists execution_locked_at timestamptz;

update token_payouts
set tx_signature = coalesce(tx_signature, payout_signature),
    amount_base_units = coalesce(amount_base_units, amount),
    recipient_wallet = coalesce(recipient_wallet, recipient_wallet_address),
    paid_at = coalesce(paid_at, confirmed_at)
where tx_signature is null
   or amount_base_units is null
   or recipient_wallet is null
   or paid_at is null;

-- Expand token_rooms.status values for C.3 while preserving existing data.
do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'token_rooms'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%created%depositing%locked%';

  if constraint_name is not null then
    execute format('alter table token_rooms drop constraint %I', constraint_name);
  end if;

  alter table token_rooms
    add constraint token_rooms_status_check check (
      status in (
        'created','depositing','locked','racing','results_recorded','settlement_pending','finalizing','manual_review',
        'payout_pending','paid','paid_out','completed','refund_pending','refunded','cancelled','expired','payout_failed'
      )
    );
end $$;

-- Expand token_payouts.payout_type and status values for C.3.
do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'token_payouts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%payout_type%';

  if constraint_name is not null then
    execute format('alter table token_payouts drop constraint %I', constraint_name);
  end if;

  alter table token_payouts
    add constraint token_payouts_payout_type_check check (
      payout_type in ('player','weekly_reward_pool','treasury_fee','winner_payout','rounding_dust','manual_adjustment')
    );
end $$;

do $$
declare constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'token_payouts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%planned%pending%sent%';

  if constraint_name is not null then
    execute format('alter table token_payouts drop constraint %I', constraint_name);
  end if;

  alter table token_payouts
    add constraint token_payouts_status_check check (
      status in ('planned','pending','sent','confirmed','pending_execution','executing','paid','failed','cancelled','manual_review')
    );
end $$;

create unique index if not exists token_payouts_tx_signature_unique
  on token_payouts(tx_signature)
  where tx_signature is not null;

create unique index if not exists token_payouts_room_type_recipient_rank_unique
  on token_payouts(room_id, payout_type, recipient_wallet_address, coalesce(payout_rank, 0), coalesce(placement, 0));

create index if not exists token_payouts_room_status_idx
  on token_payouts(room_id, status);

create index if not exists token_rooms_settlement_lock_idx
  on token_rooms(room_id, settlement_lock_id)
  where settlement_lock_id is not null;
