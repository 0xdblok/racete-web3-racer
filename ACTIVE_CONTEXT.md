# Active Context

Current milestone: Sketchfab realistic car asset download

Completed:
- Downloaded 4 Sketchfab assets via authenticated API:
  - Tesla Cybertruck → street-rat/scene.gltf (420K)
  - BMW M4 Competition → bavaro-coupe/scene.gltf (14M)
  - Ferrari SF90 Spider 2021 → furia-gt/scene.gltf (19M)
  - Lamborghini Urus SDC Carbone Edition → toro-x/scene.gltf (30M)
- Fixed TypeScript type conflict by removing @types/web package.
- Updated car config modelUrl paths to glTF packages.
- Updated docs/assets.md and public/models/cars/README.md.

Blocked assets:
- Audi e-tron GT quattro 2022 (Editorial, not downloadable)
- Bugatti Chiron Pur Sport 2021 (Editorial, not downloadable)

Next:
- Run local smoke test with a real downloaded model.
- Commit, push, verify Vercel deployment.
