# Racete Car Specs — Real-world reference

Prototype / test mode. Real model names used during development.
Sources: manufacturer pages, Wikipedia, automobile-catalog.com, fastestlaps.com, Car and Driver, auto-data.net.

| # | Game ID | Real Name | Class | Top Speed | 0-100 km/h | HP | Weight (kg) | Source |
|---|---|---|---|---|---|---|---|---|
| 1 | street-rat | Tesla Cybertruck | C | 209 km/h (130 mph) | ~2.9s (0-60) | 845 (tri-motor) | 3,084 | tesla.com/cybertruck |
| 2 | bavaro-coupe | BMW M4 Competition | B | 290 km/h (180 mph) | 3.9s | 503 | 1,780 | bmw.com |
| 3 | aurox-v10 | Audi e-tron GT quattro 2022 | B | 245 km/h (152 mph) | 3.9s | 469 | 2,200 | audi.com |
| 4 | sturm-rs | Bugatti Chiron Pur Sport 2021 | S | 350 km/h (217 mph) | 2.4s | 1,500 (W16) | 1,995 | bugatti.com |
| 5 | furia-gt | Ferrari SF90 Spider 2021 | S | 340 km/h (211 mph) | 2.5s | 986 (hybrid) | 1,670 | ferrari.com |
| 6 | toro-x | Lamborghini Urus SDC Carbone | A | 305 km/h (190 mph) | 3.4s | 641 | 2,200 | lamborghini.com |
| 7 | nova-s1 | Audi Nuvolari concept | B+ | ~300 km/h (est) | ~3.5s (est) | ~600 (est) | ~1,600 (est) | Concept — no official specs. Estimates based on performance EV concepts. |
| 8 | bavaro-sport | BMW 330i | C+ | 250 km/h (155 mph) | 5.8s | 255 | 1,590 | bmw.com |
| 9 | zephyr-z8 | Subaru BRZ | C | 226 km/h (140 mph) | 6.3s | 228 | 1,280 | subaru.com |
| 10 | bavaro-m5 | BMW M5 2025 | A | 305 km/h (190 mph) | 3.4s | 717 (hybrid) | 2,435 | bmw.com |
| 11 | toro-se | Lamborghini Urus SE 2025 | A | 312 km/h (194 mph) | 3.4s | 789 (hybrid) | 2,300 | lamborghini.com |
| 12 | valor-gt | Aston Martin Valiant 2025 | S | ~340 km/h (est) | ~3.3s (est) | 734 | ~1,600 (est) | automobile-catalog.com — top speed/accel not officially released. Limited edition (38 units). |
| 13 | warp-x1 | McLaren W1 2025 | S | 350 km/h (217 mph) | 2.7s | 1,258 (hybrid) | 1,587 | caranddriver.com, accelerationtimes.com |
| 14 | nova-spider | McLaren Artura Spider 2025 | S | 330 km/h (205 mph) | 3.0s | 690 (hybrid) | 1,560 | mclaren.com |
| 15 | volt-w6 | BYD Seal 6 DM-i Touring | D | 180 km/h (112 mph) | 7.5s | ~215 comb | 1,710 | wikipedia.org, accelerationtimes.com |
| 16 | volt-c5 | BYD Seal 5 DM-i Chazor | D | 180 km/h (112 mph) | 7.5s | 212 | ~1,600 | auto-data.net, lum-auto.com |
| 17 | bavaro-cs | BMW M3 CS Touring | A | 302 km/h (188 mph) | 3.5s | 543 | 1,855 | bmw.com |

## Notes

- **Audi Nuvolari concept**: No production specs exist. All values estimated from comparable performance EV concepts. This car will need tuning after playtesting.
- **Aston Martin Valiant**: Top speed and 0-60 not officially published. Estimates from ProfessCars™ modeling and comparable Aston Martin models.
- **BYD Seal models**: Specs vary by market and trim. Values shown are for the hybrid (DM-i) variants with combined system output.
- **Tesla Cybertruck**: 0-60 time is with rollout subtracted (Tesla method). Actual real-world 0-60 is closer to 3.5s. Top speed varies by trim (Cyberbeast = 130 mph).
- **Bugatti Chiron Pur Sport**: Top speed is electronically limited to 350 km/h (aerodynamic/tyre limit for the Pur Sport variant). Standard Chiron Super Sport reaches 490 km/h.

## Game Stat Conversions

Real specs → game stats (0-100 scale):

- **Speed**: Derived from top speed. ~180 km/h = 35, ~250 km/h = 60, ~300 km/h = 75, ~350 km/h = 95.
- **Acceleration**: Derived from 0-100 km/h. ~8s = 30, ~5s = 50, ~3s = 75, ~2.5s = 90.
- **Handling**: Based on weight, drivetrain, car type. Lightweight RWD sports cars (BRZ) = high; heavy AWD SUVs (Urus) = moderate.
- **Nitro**: Based on performance tier. Hypercars = high; economy hybrids = low.
- **Base Power Rating (PR)**: Overall game balance score, not literal horsepower. Scaled to create competitive brackets.

## Class Changes from Original Fictional Names

| Car | Old Class | New Class | Reason |
|---|---|---|---|
| Tesla Cybertruck | D | C | 845 hp tri-motor, 0-60 in 2.9s — too fast for D class |
| BMW M4 Competition | C | B | 503 hp sports coupe — competitive B class |
| Bugatti Chiron Pur Sport | B+ | S | 1,500 hp hypercar — must be top tier |
| Ferrari SF90 Spider | A | S | 986 hp hybrid hypercar — S tier |
| Lamborghini Urus | S | A | 641 hp super SUV — fast but not hypercar |
| Audi Nuvolari concept | B | B+ | Estimated performance justifies B+ |
| BMW 330i | C | C+ | 255 hp sports sedan — above C floor |
| McLaren Artura Spider | A | S | 690 hp hybrid — S tier alongside SF90 |

Prices have NOT been adjusted. Price rebalancing is a separate task.
