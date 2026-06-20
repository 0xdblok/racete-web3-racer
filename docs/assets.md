# Racete Asset Sources

## Sketchfab car pass — selected candidates

Source scope for this pass: Sketchfab cars only.

### Toro X candidate
- Sketchfab URL: https://sketchfab.com/3d-models/low-poly-lamborghini-revuelto-2023-a5ccfea90e894404a822d9d3d9043c16
- Sketchfab model name: Low Poly Lamborghini Revuelto 2023
- Author: Himanshu (`rohithimanshu545`)
- Author URL: https://sketchfab.com/rohithimanshu545
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- In-game assignment: Toro X
- Intended downloaded path: `public/models/cars/toro-x.glb`
- Weight notes: ~5.6k vertices / ~8.5k faces from Sketchfab API; good browser candidate.
- Status: selected, but not committed yet because Sketchfab's official generated GLB download endpoint requires authenticated OAuth access.

### Aurox V10 candidate
- Sketchfab URL: https://sketchfab.com/3d-models/1997-audi-s4-b5-8bdf52403bef4129a4ce4f5bd1341379
- Sketchfab model name: 1997 Audi S4 B5
- Author: tonielpro520
- Author URL: https://sketchfab.com/tonielpro520
- License: Creative Commons Attribution 4.0 (`CC BY 4.0`)
- License summary: attribution required; commercial use allowed.
- In-game assignment: Aurox V10
- Intended downloaded path: `public/models/cars/aurox-v10.glb`
- Weight notes: ~103k vertices / ~171k faces from Sketchfab API; acceptable only if optimized or if textures are not too large.
- Status: selected backup/candidate, but not committed yet because Sketchfab's official generated GLB download endpoint requires authenticated OAuth access.

## Implementation note

The race scene now uses `CarModel` with `@react-three/drei` `useGLTF` and keeps a fallback car mesh if the GLB is missing or fails to load. Once a Sketchfab OAuth token/account download is available, place the downloaded GLB at the intended path above and the selected in-game car will render it automatically without renaming the public UI car names.
