# Racete Asset Sources

Source scope for this pass: Sketchfab cars only.

Prototype/test-mode naming rule: keep the real Sketchfab model/brand names in dev docs and asset notes for now. Brand/legal cleanup is a later pre-public-launch task.

## Downloaded assets

### Street Rat → Tesla Cybertruck
- Sketchfab URL: https://sketchfab.com/3d-models/tesla-cybertruck-f12e67159f75486bb21213e573520612
- Model: Tesla Cybertruck
- Author: Lexyc16
- License: CC BY 4.0
- Downloadable: yes
- API weight: ~4.4k vertices / ~8.0k faces
- File: `public/models/cars/street-rat/scene.gltf`
- Package size: 420K

### Bavaro Coupe → BMW M4 Competition
- Sketchfab URL: https://sketchfab.com/3d-models/bmw-m4-competition-6b4d1393bd7c437eb6fc37bf937d96b2
- Model: Bmw m4 competition
- Author: RES1N
- License: CC BY 4.0
- Downloadable: yes
- API weight: ~160.5k vertices / ~275.9k faces
- File: `public/models/cars/bavaro-coupe/scene.gltf`
- Package size: 14M

### Furia GT → Ferrari SF90 Spider 2021
- Sketchfab URL: https://sketchfab.com/3d-models/2021-ferrari-sf90-spider-8f8ef613e39746668b4f0268a3176dde
- Model: 2021 Ferrari SF90 Spider
- Author: Ddiaz Design
- License: CC BY 4.0
- Downloadable: yes
- API weight: ~157.7k vertices / ~245.3k faces
- File: `public/models/cars/furia-gt/scene.gltf`
- Package size: 19M

### Toro X → Lamborghini Urus SDC Carbone Edition
- Sketchfab URL: https://sketchfab.com/3d-models/free-lamborghini-urus-sdc-carbone-edition-647849f2b10e42a39365a0f572968f5e
- Model: ( FREE ) Lamborghini Urus - SDC Carbone Edition
- Author: SDC PERFORMANCE™️
- License: CC BY 4.0
- Downloadable: yes
- API weight: ~198.6k vertices / ~365.0k faces
- File: `public/models/cars/toro-x/scene.gltf`
- Package size: 30M

## Blocked / not downloadable

### Aurox V10 → Audi e-tron GT quattro 2022
- Sketchfab URL: https://sketchfab.com/3d-models/audi-e-tron-gt-quattro-2022-ccb4d9d6980b4ab9b7909c16221ee806
- Model: Audi e-tron GT quattro 2022
- Author: SQUIR3D
- License: Editorial
- Downloadable: no
- API weight: ~895.2k vertices / ~1.7M faces
- Status: fallback mesh only; needs replacement asset

### Sturm RS → Bugatti Chiron Pur Sport 2021
- Sketchfab URL: https://sketchfab.com/3d-models/bugatti-chiron-pur-sport-2021-dbba6981d9fc4394a58ef7dcae62ad4d
- Model: Bugatti Chiron Pur Sport 2021
- Author: SQUIR3D
- License: Editorial
- Downloadable: no
- API weight: ~933.2k vertices / ~1.7M faces
- Status: fallback mesh only; needs replacement asset

## In-game name mapping (prototype)

| In-game name | Real model | File path |
|-------------|-----------|-----------|
| Street Rat | Tesla Cybertruck | `public/models/cars/street-rat/scene.gltf` |
| Bavaro Coupe | BMW M4 Competition | `public/models/cars/bavaro-coupe/scene.gltf` |
| Aurox V10 | Audi e-tron GT quattro 2022 | `public/models/cars/aurox-v10.glb` (fallback) |
| Sturm RS | Bugatti Chiron Pur Sport 2021 | `public/models/cars/sturm-rs.glb` (fallback) |
| Furia GT | Ferrari SF90 Spider 2021 | `public/models/cars/furia-gt/scene.gltf` |
| Toro X | Lamborghini Urus SDC Carbone Edition | `public/models/cars/toro-x/scene.gltf` |

## Notes
- All downloaded assets are CC BY 4.0; attribution required.
- Editorial models (Audi, Bugatti) cannot be downloaded via Sketchfab API; they remain fallback meshes.
- The BMW, Ferrari, and Lamborghini packages are large (14M–30M); may need optimization before public launch.
