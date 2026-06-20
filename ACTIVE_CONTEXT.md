# Active Context

Current milestone: Sketchfab realistic car asset pass

Completed:
- Selected Sketchfab-only candidate assets for Toro X and Aurox V10 with CC BY 4.0 license metadata.
- Added `docs/assets.md` attribution/download notes.
- Added `CarModel` component using `@react-three/drei` `useGLTF` with fallback mesh when local GLB files are missing or fail to load.
- Wired `/race` scene to load selected car model URL from car config.
- Added `public/models/cars/README.md` with expected downloaded file names.

Blocked:
- Actual Sketchfab GLB download requires authenticated Sketchfab OAuth/account access. No Sketchfab token exists in local env/secrets, so no real GLB asset was committed in this pass.

Next task:
- Provide a Sketchfab OAuth token or manually download the selected GLBs, then place them at `public/models/cars/toro-x.glb` and `public/models/cars/aurox-v10.glb`.

Important files:
- `docs/assets.md`
- `public/models/cars/README.md`
- `src/components/race/CarModel.tsx`
- `src/components/race/RaceScene.tsx`
