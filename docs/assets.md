# Racete Asset Sources

Source scope for this pass: Sketchfab cars only.

Prototype/test-mode naming rule: keep the real Sketchfab model/brand names in dev docs and asset notes for now. Existing DB/UI car names can remain fictional unless a future milestone explicitly changes the garage catalog labels.

## Final prototype asset mapping

### Street Rat → Tesla Cybertruck
- Sketchfab URL: https://sketchfab.com/3d-models/tesla-cybertruck-f12e67159f75486bb21213e573520612
- Real asset/model name: Tesla Cybertruck
- Author: Lexyc16 (`Lexyc16`)
- Author URL: https://sketchfab.com/Lexyc16
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~4.4k / ~8.0k
- Intended downloaded path: `public/models/cars/street-rat.glb`
- Notes: very browser-friendly; good prototype starter/utility vehicle.

### Bavaro Coupe → BMW M4 Competition
- Sketchfab URL: https://sketchfab.com/3d-models/bmw-m4-competition-6b4d1393bd7c437eb6fc37bf937d96b2
- Real asset/model name: BMW M4 Competition
- Author: RES1N (`Resinnnn`)
- Author URL: https://sketchfab.com/Resinnnn
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~160.5k / ~275.9k
- Intended downloaded path: `public/models/cars/bavaro-coupe.glb`
- Notes: realistic; should be optimized after download if textures/polycount are heavy.

### Aurox V10 → Audi e-tron GT quattro 2022
- Sketchfab URL: https://sketchfab.com/3d-models/audi-e-tron-gt-quattro-2022-ccb4d9d6980b4ab9b7909c16221ee806
- Real asset/model name: Audi e-tron GT quattro 2022
- Author: SQUIR3D (`SQUIR3D`)
- Author URL: https://sketchfab.com/SQUIR3D
- License: Editorial
- License summary: use only in connection with newsworthy/public-interest events; not suitable for public game launch without replacement/permission.
- Downloadable: no
- Vertices/faces: ~895.2k / ~1.7M
- Intended downloaded path: `public/models/cars/aurox-v10.glb`
- Notes: kept in prototype mapping per founder request, but GLB is not available from Sketchfab download API and asset is very heavy.

### Sturm RS → Bugatti Chiron Pur Sport 2021
- Sketchfab URL: https://sketchfab.com/3d-models/bugatti-chiron-pur-sport-2021-dbba6981d9fc4394a58ef7dcae62ad4d
- Real asset/model name: Bugatti Chiron Pur Sport 2021
- Author: SQUIR3D (`SQUIR3D`)
- Author URL: https://sketchfab.com/SQUIR3D
- License: Editorial
- License summary: use only in connection with newsworthy/public-interest events; not suitable for public game launch without replacement/permission.
- Downloadable: no
- Vertices/faces: ~933.2k / ~1.7M
- Intended downloaded path: `public/models/cars/sturm-rs.glb`
- Notes: kept in prototype mapping per founder request, but GLB is not available from Sketchfab download API and asset is very heavy.

### Furia GT → Ferrari SF90 Spider 2021
- Sketchfab URL: https://sketchfab.com/3d-models/2021-ferrari-sf90-spider-8f8ef613e39746668b4f0268a3176dde
- Real asset/model name: Ferrari SF90 Spider 2021
- Author: Ddiaz Design (`ddiaz-design`)
- Author URL: https://sketchfab.com/ddiaz-design
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~157.7k / ~245.3k
- Intended downloaded path: `public/models/cars/furia-gt.glb`
- Notes: realistic; should be optimized after download if textures/polycount are heavy.

### Toro X → Lamborghini Urus SDC Carbone Edition
- Sketchfab URL: https://sketchfab.com/3d-models/free-lamborghini-urus-sdc-carbone-edition-647849f2b10e42a39365a0f572968f5e
- Real asset/model name: Lamborghini Urus SDC Carbone Edition
- Author: SDC PERFORMANCE™️ (`Lambo_SC04`)
- Author URL: https://sketchfab.com/Lambo_SC04
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~198.6k / ~365.0k
- Intended downloaded path: `public/models/cars/toro-x.glb`
- Notes: realistic; likely needs browser optimization after download.

## Missing GLB files

The race scene uses `CarModel` with `@react-three/drei` `useGLTF` and a fallback mesh if a GLB is missing or fails to load. Gameplay is not blocked by missing assets.

Expected local files:
- `public/models/cars/street-rat.glb` — Tesla Cybertruck
- `public/models/cars/bavaro-coupe.glb` — BMW M4 Competition
- `public/models/cars/aurox-v10.glb` — Audi e-tron GT quattro 2022
- `public/models/cars/sturm-rs.glb` — Bugatti Chiron Pur Sport 2021
- `public/models/cars/furia-gt.glb` — Ferrari SF90 Spider 2021
- `public/models/cars/toro-x.glb` — Lamborghini Urus SDC Carbone Edition

Download status:
- Downloadable via Sketchfab account/OAuth: Tesla Cybertruck, BMW M4 Competition, Ferrari SF90 Spider 2021, Lamborghini Urus SDC Carbone Edition.
- Not downloadable from Sketchfab metadata: Audi e-tron GT quattro 2022, Bugatti Chiron Pur Sport 2021.
- No actual GLB files are committed yet.
