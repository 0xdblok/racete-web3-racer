# Racete Asset Sources

Source scope for this pass: Sketchfab cars only.

Important UI rule: public game UI keeps fictional Racete names only. Brand/model names below are attribution/source records, not in-game names.

## Selected Sketchfab car list from founder

### Street Rat — candidate source
- Sketchfab URL: https://sketchfab.com/3d-models/tesla-cybertruck-f12e67159f75486bb21213e573520612
- Sketchfab model name: Tesla Cybertruck
- Author: Lexyc16 (`Lexyc16`)
- Author URL: https://sketchfab.com/Lexyc16
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~4.4k / ~8.0k
- Intended downloaded path: `public/models/cars/street-rat.glb`
- Notes: very browser-friendly. Good temporary starter/utility placeholder if founder approves this mapping.

### Bavaro Coupe — selected source
- Sketchfab URL: https://sketchfab.com/3d-models/bmw-m4-competition-6b4d1393bd7c437eb6fc37bf937d96b2
- Sketchfab model name: Bmw m4 competition
- Author: RES1N (`Resinnnn`)
- Author URL: https://sketchfab.com/Resinnnn
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~160.5k / ~275.9k
- Intended downloaded path: `public/models/cars/bavaro-coupe.glb`
- Notes: realistic, but should be optimized after download if textures/polycount are heavy.

### Aurox V10 — blocked source from founder list
- Sketchfab URL: https://sketchfab.com/3d-models/audi-e-tron-gt-quattro-2022-ccb4d9d6980b4ab9b7909c16221ee806
- Sketchfab model name: Audi e-tron GT quattro 2022
- Author: SQUIR3D (`SQUIR3D`)
- Author URL: https://sketchfab.com/SQUIR3D
- License: Editorial
- License summary: use only in connection with newsworthy/public-interest events; not suitable for this game.
- Downloadable: no
- Vertices/faces: ~895.2k / ~1.7M
- Intended downloaded path if replaced by a usable asset: `public/models/cars/aurox-v10.glb`
- Notes: do not use this asset in the game. Need a downloadable CC/commercial-allowed Audi-style replacement.

### Sturm RS — open slot
- Current intended path: `public/models/cars/sturm-rs.glb`
- Notes: founder has not provided a Porsche-style usable Sketchfab asset yet. Keep fallback mesh until a downloadable CC/commercial-allowed source is provided.

### Furia GT — selected source
- Sketchfab URL: https://sketchfab.com/3d-models/2021-ferrari-sf90-spider-8f8ef613e39746668b4f0268a3176dde
- Sketchfab model name: 2021 Ferrari SF90 Spider
- Author: Ddiaz Design (`ddiaz-design`)
- Author URL: https://sketchfab.com/ddiaz-design
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~157.7k / ~245.3k
- Intended downloaded path: `public/models/cars/furia-gt.glb`
- Notes: realistic, but should be optimized after download if textures/polycount are heavy.

### Toro X — selected source
- Sketchfab URL: https://sketchfab.com/3d-models/free-lamborghini-urus-sdc-carbone-edition-647849f2b10e42a39365a0f572968f5e
- Sketchfab model name: ( FREE ) Lamborghini Urus - SDC Carbone Edition
- Author: SDC PERFORMANCE™️ (`Lambo_SC04`)
- Author URL: https://sketchfab.com/Lambo_SC04
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- Downloadable: yes
- Vertices/faces: ~198.6k / ~365.0k
- Intended downloaded path: `public/models/cars/toro-x.glb`
- Notes: realistic, but likely needs browser optimization after download.

### Extra founder-provided asset — blocked
- Sketchfab URL: https://sketchfab.com/3d-models/bugatti-chiron-pur-sport-2021-dbba6981d9fc4394a58ef7dcae62ad4d
- Sketchfab model name: Bugatti Chiron Pur Sport 2021
- Author: SQUIR3D (`SQUIR3D`)
- Author URL: https://sketchfab.com/SQUIR3D
- License: Editorial
- License summary: use only in connection with newsworthy/public-interest events; not suitable for this game.
- Downloadable: no
- Vertices/faces: ~933.2k / ~1.7M
- Notes: do not use this asset in the game. Also too heavy for browser MVP as-is.

## Download status

The race scene already uses `CarModel` with `@react-three/drei` `useGLTF` and a fallback mesh if a GLB is missing or fails to load.

Official Sketchfab generated GLB downloads require authenticated Sketchfab OAuth/account access. No Sketchfab token exists in local env/secrets, so the real GLB files are not committed yet.

Once downloaded, place files here:
- `public/models/cars/street-rat.glb`
- `public/models/cars/bavaro-coupe.glb`
- `public/models/cars/furia-gt.glb`
- `public/models/cars/toro-x.glb`

Blocked/replacement-needed files:
- `public/models/cars/aurox-v10.glb` — current founder-provided Audi link is Editorial + not downloadable.
- `public/models/cars/sturm-rs.glb` — needs a usable Porsche-style Sketchfab URL.
