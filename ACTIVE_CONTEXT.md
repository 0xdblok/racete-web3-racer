# Active Context

Current milestone: Prototype Sketchfab real-name asset mapping

Completed:
- Updated asset docs to keep real Sketchfab model/brand names in prototype/test mode.
- Final prototype mapping:
  - Street Rat → Tesla Cybertruck
  - Bavaro Coupe → BMW M4 Competition
  - Aurox V10 → Audi e-tron GT quattro 2022
  - Sturm RS → Bugatti Chiron Pur Sport 2021
  - Furia GT → Ferrari SF90 Spider 2021
  - Toro X → Lamborghini Urus SDC Carbone Edition
- Kept existing fictional DB/UI car names unchanged for now.
- Kept fallback mesh path unchanged for missing GLB files.

Missing GLB files:
- `public/models/cars/street-rat.glb`
- `public/models/cars/bavaro-coupe.glb`
- `public/models/cars/aurox-v10.glb`
- `public/models/cars/sturm-rs.glb`
- `public/models/cars/furia-gt.glb`
- `public/models/cars/toro-x.glb`

Next task:
- Add actual GLB files once downloaded/provided, then run race scene smoke test with real models.

Important files:
- `docs/assets.md`
- `public/models/cars/README.md`
