-- Migration: Add race_records table for personal-record tracking
-- Run with: supabase db push

create table if not exists race_records (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references players(wallet_address) on delete cascade,
  track_id text not null,
  car_class text not null,
  best_total_time_ms int,
  best_first_lap_ms int,
  best_lap_ms int,
  total_races_finished int not null default 0,
  total_race_cash_earned numeric not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(wallet_address, track_id, car_class)
);

create index if not exists race_records_wallet_idx on race_records(wallet_address);

alter table race_records enable row level security;
