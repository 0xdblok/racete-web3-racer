-- Token Stake Rooms Phase C.2 deposit ledger hardening.
-- Additive only. Enables per-room/player deposit accounting while automatic payouts remain disabled.

alter table token_deposits
  add column if not exists tx_signature text,
  add column if not exists player_wallet text,
  add column if not exists mint text,
  add column if not exists amount_base_units numeric(38,0),
  add column if not exists amount_ui numeric,
  add column if not exists deposit_wallet text,
  add column if not exists token_program text,
  add column if not exists detected_at timestamptz;

-- Backfill aliases from Phase A columns where applicable.
update token_deposits
set tx_signature = coalesce(tx_signature, deposit_signature),
    amount_base_units = coalesce(amount_base_units, stake_amount),
    player_wallet = coalesce(player_wallet, wallet_address),
    mint = coalesce(mint, token_mint),
    detected_at = coalesce(detected_at, submitted_at, confirmed_at, updated_at)
where tx_signature is null
   or amount_base_units is null
   or player_wallet is null
   or mint is null
   or detected_at is null;

-- A Solana transaction signature can confirm exactly one token-room deposit.
create unique index if not exists token_deposits_tx_signature_unique
  on token_deposits(tx_signature)
  where tx_signature is not null;

-- A player can have at most one confirmed deposit ledger row per token room.
create unique index if not exists token_deposits_room_wallet_confirmed_unique
  on token_deposits(room_id, wallet_address)
  where status = 'confirmed';

create index if not exists token_deposits_room_status_idx
  on token_deposits(room_id, status);

create index if not exists token_deposits_wallet_status_idx
  on token_deposits(wallet_address, status);
