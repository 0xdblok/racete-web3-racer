-- Migration: Align cars_catalog with src/config/cars.ts + recalculate player_cars.power_rating
-- Run in Supabase SQL Editor (service-role REST cannot do DDL/UPDATE with joins)
--
-- Fixes data drift: DB had legacy base_power_rating values that didn't match the config.
-- Also fixes class assignments that changed (e.g. street-rat moved from D to C).

-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 1: Upsert all 17 cars from src/config/cars.ts into cars_catalog
-- ══════════════════════════════════════════════════════════════════════════════

insert into cars_catalog (id, name, class, model_url, base_power_rating, price_race_cash, price_token, is_starter, is_active) values
  ('street-rat',    'Tesla Cybertruck',           'C',  '/models/cars/street-rat/scene.gltf',       280,        0,       0, true,  true),
  ('bavaro-coupe',  'BMW M4 Competition',         'B',  '/models/cars/bavaro-coupe/scene.gltf',     480,    40000,       0, false, true),
  ('aurox-v10',     'Audi e-tron GT quattro',     'B',  '',                                            450,   120000,       0, false, true),
  ('sturm-rs',      'Bugatti Chiron Pur Sport',   'S',  '',                                            940,   250000,   25000, false, true),
  ('furia-gt',      'Ferrari SF90 Spider',        'S',  '/models/cars/furia-gt/scene.gltf',          900,   500000,   75000, false, true),
  ('toro-x',        'Lamborghini Urus',           'A',  '/models/cars/toro-x/scene.gltf',            720,  1000000,  200000, false, true),
  ('nova-s1',       'Audi Nuvolari concept',      'B+', '/models/cars/audi-novulari/scene.gltf',     620,   140000,       0, false, true),
  ('bavaro-sport',  'BMW 330i',                   'C+', '/models/cars/bmw-330i/scene.gltf',          380,    50000,       0, false, true),
  ('zephyr-z8',     'Subaru BRZ',                 'C',  '/models/cars/subaru-brz/scene.gltf',        350,    45000,       0, false, true),
  ('bavaro-m5',     'BMW M5 2025',                'A',  '/models/cars/bmw-m5-sedan/scene.gltf',      730,   300000,   30000, false, true),
  ('toro-se',       'Lamborghini Urus SE 2025',   'A',  '/models/cars/lambo-urus-se/scene.gltf',    760,   600000,   80000, false, true),
  ('valor-gt',      'Aston Martin Valiant',       'S',  '/models/cars/aston-martin-valiant/scene.gltf', 850, 650000,  85000, false, true),
  ('warp-x1',       'McLaren W1 2025',            'S',  '/models/cars/mclaren-w1/scene.gltf',        980,  1200000,  250000, false, true),
  ('nova-spider',   'McLaren Artura Spider',      'S',  '/models/cars/mclaren-artura/scene.gltf',    820,   550000,   70000, false, true),
  ('volt-w6',       'BYD Seal 6 DM-i Touring',    'D',  '/models/cars/byd-seal-6/scene.gltf',        200,    35000,       0, false, true),
  ('volt-c5',       'BYD Seal 5 DM-i',            'D',  '/models/cars/byd-seal-5/scene.gltf',        190,    30000,       0, false, true),
  ('bavaro-cs',     'BMW M3 CS Touring',          'A',  '/models/cars/bmw-m3-cs/scene.gltf',         700,   350000,   40000, false, true)
on conflict (id) do update set
  name                = excluded.name,
  class               = excluded.class,
  model_url           = excluded.model_url,
  base_power_rating   = excluded.base_power_rating,
  price_race_cash     = excluded.price_race_cash,
  price_token         = excluded.price_token,
  is_starter          = excluded.is_starter,
  is_active           = excluded.is_active;

-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 2: Recalculate player_cars.power_rating using the same formula as
-- calculatePowerRating() in src/config/upgrades.ts:
--   PR = basePR + (engine-1)*14 + (tires-1)*10 + (nitro-1)*11 + (handling-1)*9
-- ══════════════════════════════════════════════════════════════════════════════

update player_cars pc
set power_rating = cc.base_power_rating
  + (pc.engine_level - 1) * 14
  + (pc.tires_level - 1) * 10
  + (pc.nitro_level - 1) * 11
  + (pc.handling_level - 1) * 9
from cars_catalog cc
where pc.car_id = cc.id;

-- ══════════════════════════════════════════════════════════════════════════════
-- Verification queries (run manually after migration)
-- ══════════════════════════════════════════════════════════════════════════════

-- Check street-rat base_power_rating is now 280:
-- select id, name, class, base_power_rating from cars_catalog where id = 'street-rat';

-- Check a player car PR was recalculated:
-- select pc.car_id, cc.base_power_rating,
--   pc.engine_level, pc.tires_level, pc.nitro_level, pc.handling_level,
--   pc.power_rating as new_pr
-- from player_cars pc join cars_catalog cc on pc.car_id = cc.id
-- where pc.wallet_address = '7X6GqFYd3NuqF7wC8VnTGG4p1BqFKLx9JHFmzWvBcKrA';
