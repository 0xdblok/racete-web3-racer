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
  ('street-rat','Tesla Cybertruck','C','/models/cars/street-rat/scene.gltf',280,0,0,true),
  ('bavaro-coupe','BMW M4 Competition','B','/models/cars/bavaro-coupe/scene.gltf',480,40000,0,false),
  ('aurox-v10','Audi e-tron GT quattro','B','',450,120000,0,false),
  ('sturm-rs','Bugatti Chiron Pur Sport','S','',940,250000,25000,false),
  ('furia-gt','Ferrari SF90 Spider','S','/models/cars/furia-gt/scene.gltf',900,500000,75000,false),
  ('toro-x','Lamborghini Urus','A','/models/cars/toro-x/scene.gltf',720,1000000,200000,false),
  ('nova-s1','Audi Nuvolari concept','B+','/models/cars/audi-novulari/scene.gltf',620,140000,0,false),
  ('bavaro-sport','BMW 330i','C+','/models/cars/bmw-330i/scene.gltf',380,50000,0,false),
  ('zephyr-z8','Subaru BRZ','C','/models/cars/subaru-brz/scene.gltf',350,45000,0,false),
  ('bavaro-m5','BMW M5 2025','A','/models/cars/bmw-m5-sedan/scene.gltf',730,300000,30000,false),
  ('toro-se','Lamborghini Urus SE 2025','A','/models/cars/lambo-urus-se/scene.gltf',760,600000,80000,false),
  ('valor-gt','Aston Martin Valiant','S','/models/cars/aston-martin-valiant/scene.gltf',850,650000,85000,false),
  ('warp-x1','McLaren W1 2025','S','/models/cars/mclaren-w1/scene.gltf',980,1200000,250000,false),
  ('nova-spider','McLaren Artura Spider','S','/models/cars/mclaren-artura/scene.gltf',820,550000,70000,false),
  ('volt-w6','BYD Seal 6 DM-i Touring','D','/models/cars/byd-seal-6/scene.gltf',200,35000,0,false),
  ('volt-c5','BYD Seal 5 DM-i','D','/models/cars/byd-seal-5/scene.gltf',190,30000,0,false),
  ('bavaro-cs','BMW M3 CS Touring','A','/models/cars/bmw-m3-cs/scene.gltf',700,350000,40000,false)
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

create table if not exists race_rewards (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null references players(wallet_address) on delete cascade,
  race_mode text not null check (race_mode in ('solo','multiplayer')),
  track_id text not null,
  car_id text not null,
  client_race_id text not null,
  total_time_ms int not null,
  best_lap_ms int not null,
  laps_completed int not null,
  checkpoints_completed int not null,
  placement int,
  reward_amount numeric not null default 0,
  reward_breakdown jsonb not null default '{}'::jsonb,
  status text not null check (status in ('paid','rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique(wallet_address, client_race_id)
);

create index if not exists race_rewards_wallet_created_idx on race_rewards(wallet_address, created_at desc);

alter table race_rewards enable row level security;

-- Personal records per player, track, and car class
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

-- Hard Objectives / Missions V1
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

drop policy if exists "cars_catalog_public_read" on cars_catalog;
create policy "cars_catalog_public_read" on cars_catalog for select using (is_active = true);
