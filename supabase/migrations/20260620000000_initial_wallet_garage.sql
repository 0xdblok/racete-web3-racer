-- Racete MVP wallet/player/garage foundation. Run in Supabase SQL editor.
create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  username text,
  created_at timestamptz not null default now(),
  last_login timestamptz,
  earned_race_cash numeric not null default 0,
  purchased_race_cash numeric not null default 0,
  total_token_spent numeric not null default 0,
  season_token_spent numeric not null default 0,
  weekly_races_count int not null default 0,
  weekly_wins_count int not null default 0,
  weekly_podiums_count int not null default 0,
  active_days_count int not null default 0,
  anti_cheat_flag boolean not null default false
);

create table if not exists cars_catalog (
  id text primary key,
  name text not null,
  class text not null,
  model_url text not null,
  base_power_rating int not null,
  price_race_cash numeric not null default 0,
  price_token numeric not null default 0,
  max_speed numeric not null default 0,
  acceleration numeric not null default 0,
  brake_force numeric not null default 0,
  reverse_speed numeric not null default 0,
  handling numeric not null default 0,
  grip numeric not null default 0,
  drift_factor numeric not null default 0,
  nitro_power numeric not null default 0,
  nitro_duration numeric not null default 0,
  nitro_cooldown numeric not null default 0,
  mass_feeling numeric not null default 0,
  drag numeric not null default 0,
  collision_size jsonb not null default '{"x":2,"y":1,"z":4}'::jsonb,
  visual_scale numeric not null default 1,
  is_starter boolean not null default false,
  is_active boolean not null default true
);

create table if not exists player_cars (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references players(wallet_address) on delete cascade,
  car_id text not null references cars_catalog(id),
  engine_level int not null default 1,
  tires_level int not null default 1,
  nitro_level int not null default 1,
  handling_level int not null default 1,
  power_rating int not null,
  acquired_at timestamptz not null default now(),
  is_selected boolean not null default false,
  unique(wallet_address, car_id)
);

create table if not exists race_cash_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references players(wallet_address) on delete cascade,
  amount numeric not null,
  source text not null,
  cash_type text not null check (cash_type in ('earned','purchased')),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists payment_intents (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references players(wallet_address) on delete cascade,
  action_type text not null,
  item_id text not null,
  car_id text,
  upgrade_type text,
  token_amount numeric not null,
  token_mint text not null,
  treasury_wallet text not null,
  status text not null default 'pending',
  signature text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists token_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references players(wallet_address) on delete cascade,
  signature text unique not null,
  token_amount numeric not null,
  action_type text not null,
  payment_intent_id uuid references payment_intents(id),
  token_mint text not null,
  recipient_wallet text not null,
  status text not null,
  created_at timestamptz not null default now()
);

insert into cars_catalog (id, name, class, model_url, base_power_rating, price_race_cash, price_token, is_starter) values
  ('street-rat','Street Rat','D','/models/cars/street-rat.glb',120,0,0,true),
  ('bavaro-coupe','Bavaro Coupe','C','/models/cars/bavaro-coupe.glb',240,40000,0,false),
  ('aurox-v10','Aurox V10','B','/models/cars/aurox-v10.glb',390,120000,0,false),
  ('sturm-rs','Sturm RS','B+','/models/cars/sturm-rs.glb',520,250000,25000,false),
  ('furia-gt','Furia GT','A','/models/cars/furia-gt.glb',720,500000,75000,false),
  ('toro-x','Toro X','S','/models/cars/toro-x.glb',900,1000000,200000,false)
on conflict (id) do update set
  name = excluded.name, class = excluded.class, model_url = excluded.model_url,
  base_power_rating = excluded.base_power_rating, price_race_cash = excluded.price_race_cash,
  price_token = excluded.price_token, is_starter = excluded.is_starter;

alter table players enable row level security;
alter table cars_catalog enable row level security;
alter table player_cars enable row level security;
alter table race_cash_ledger enable row level security;
alter table payment_intents enable row level security;
alter table token_transactions enable row level security;

drop policy if exists "cars_catalog_public_read" on cars_catalog;
create policy "cars_catalog_public_read" on cars_catalog for select using (is_active = true);
