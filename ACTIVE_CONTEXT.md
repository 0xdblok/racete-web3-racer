# Active Context

Current milestone: First solo garage-to-play scene shell

Completed:
- Installed Three/R3F scene dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`.
- Added City Loop starter track config.
- Added `/race` page using connected wallet state and selected garage car.
- Added `/api/player/state` to read player state without mutating/auto-selecting fallback cars.
- Added basic 3D race shell with dark scene, track placeholder, placeholder selected car, lights, camera, and HUD.
- Added Garage/Dashboard Play buttons enabled when a selected car exists.
- Verified no-wallet `/race` shows connect-wallet message.
- Verified selected car state, no-selected fallback state, and garage buy/select/upgrade regressions.

Next task:
- Add basic keyboard car movement and follow camera, still solo-only.

Important files:
- `src/config/tracks.ts`
- `src/app/race/page.tsx`
- `src/app/api/player/state/route.ts`
- `src/components/race/RacePageClient.tsx`
- `src/components/race/RaceScene.tsx`
- `src/components/race/RaceHud.tsx`
- `src/components/WalletGameDashboard.tsx`
- `src/lib/player-state.ts`

Open blockers:
- None for solo scene shell.
- Real SPL payment success still requires the actual Pump.fun token mint, treasury wallet, and funded user token account.
