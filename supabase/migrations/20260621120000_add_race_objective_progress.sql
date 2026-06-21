-- Migration: Add race_objective_progress table for Hard Objectives / Missions V1
-- Run with: supabase db push, or paste into Supabase SQL Editor

create table if not exists race_objective_progress (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references players(wallet_address) on delete cascade,
  objective_id text not null,
  status text not null check (status in ('locked','in_progress','completed','claimed')),
  progress numeric not null default 0,
  target numeric not null default 1,
  reward_amount numeric not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(wallet_address, objective_id)
);

create index if not exists race_obj_progress_wallet_idx
  on race_objective_progress(wallet_address);

create index if not exists race_obj_progress_status_idx
  on race_objective_progress(wallet_address, status);

alter table race_objective_progress enable row level security;
