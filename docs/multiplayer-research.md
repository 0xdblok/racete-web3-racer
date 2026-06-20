# Web Racing Multiplayer Starter — Research Report

**Date:** 2026-06-20
**Context:** Racete needs multiplayer racing. Instead of building from scratch, we evaluate open-source starters to reuse car physics, Colyseus rooms, matchmaking, and race flow.

---

## Candidates Evaluated

### 1. pmndrs/racing-game ⭐ **Best foundation**

| Field | Value |
|---|---|
| Repo | https://github.com/pmndrs/racing-game |
| License | **MIT** |
| Stars | 2,203 |
| Stack | TypeScript, React Three Fiber, Three.js, Vite |
| Multiplayer | ❌ No (single-player showcase) |
| Matchmaking | ❌ No |
| Last updated | 2026-06-19 (active) |
| Live demo | https://racing.pmnd.rs/ |

**What it has:**
- Complete 3D racing game with vehicle physics
- Camera follow system (3rd person chase cam)
- Track model loading with Blender source files
- Dust, trails, skid effects
- HUD components (speed, lap timer, leaderboard)
- CC0 assets (all assets freely usable)
- Community-built, PRs welcome

**What we can reuse:**
- Car physics controller (R3F + useFrame movement)
- Camera/follow system architecture
- Race scene composition patterns
- Track loading pipeline
- Effect components (dust, skids for nitro/drift feel)
- UI/HUD patterns

**Risk:** Vite-based (not Next.js). Code needs extraction and porting, not direct integration. 24 open issues.

---

### 2. colyseus/react-racing-game ⭐ **Best for multiplayer**

| Field | Value |
|---|---|
| Repo | https://github.com/colyseus/react-racing-game |
| License | **MIT** |
| Stars | 16 |
| Stack | TypeScript, R3F, Three.js, Colyseus |
| Multiplayer | ✅ Yes (Colyseus rooms) |
| Matchmaking | ✅ Basic (create/join room) |
| Last updated | 2026-03-02 |

**Critical fact:** This is a **fork of pmndrs/racing-game** with Colyseus multiplayer layered on top.

**What it has (on top of pmndrs/racing-game):**
- Colyseus server with room state schema
- Player join/leave handling
- Position/rotation sync between clients
- Lobby → countdown → race start → finish flow
- Race results collection

**What we can reuse:**
- Colyseus room schema (`.ts` state definitions)
- Matchmaking lobby logic
- Network sync patterns (interpolation, state reconciliation)
- Race lifecycle handlers (ready → countdown → start → finish)
- Multiplayer-ready car controller

**Risk:** Low stars, infrequent updates. Based on older pmndrs/racing-game snapshot. Server code structure is simple but not production-hardened.

---

### 3. MankyDanky/web-racing ⭐ **Good patterns reference**

| Field | Value |
|---|---|
| Repo | https://github.com/MankyDanky/web-racing |
| License | **MIT** |
| Stars | 30 |
| Stack | JavaScript, Three.js, Ammo.js (Bullet Physics), PeerJS (WebRTC), Django |
| Multiplayer | ✅ Yes (PeerJS P2P over WebRTC) |
| Matchmaking | ✅ Party code system |
| Live demo | https://racez.io (playable) |

**What it has:**
- Working playable multiplayer racing game
- Physics-based driving (Ammo.js / Bullet Physics port)
- Checkpoint system with lap validation
- Leaderboard + best times
- Party system (create/join by code)
- Mobile touch controls
- Multiple tracks
- WASD keyboard controls

**What we can reuse:**
- Checkpoint/lap validation logic (pass gates in order, prevent shortcuts)
- Race start/finish flow
- Party/lobby code system pattern (simpler than full matchmaking for V1)
- Leaderboard/race results structure
- Ammo.js physics setup reference (if we need heavier physics than Rapier)

**Risk:** Django backend (not our stack). WebRTC P2P (not server-authoritative — weak anti-cheat). Plain JavaScript (not React/R3F). Ammo.js is heavier than Rapier.

---

### 4. cconsta1/threejs_car_demo ⭐ **Arcade mechanics reference**

| Field | Value |
|---|---|
| Repo | https://github.com/cconsta1/threejs_car_demo |
| License | **MIT** |
| Stars | 18 |
| Stack | JavaScript, Three.js, Cannon-es |
| Multiplayer | ❌ No |
| Last updated | 2026-03-01 |

**What it has:**
- Mario Kart-inspired driving
- Coin collection with scoring
- Boost pads on track
- Lap timer + lap counter
- Keyboard controls

**What we can reuse:**
- Simple arcade car controller (Cannon-es based, lighter than Ammo.js)
- Coin/collectible system (could adapt for Race Cash pickups or boost pads)
- Scoring/timer patterns

**Risk:** Vanilla JS (not React). Single-player only. Limited scope.

---

### 5. Yashparmar1125/Car-Game-ThreeJS ❌ **Cannot use**

| Field | Value |
|---|---|
| Repo | https://github.com/Yashparmar1125/Car-Game-ThreeJS |
| License | **NO LICENSE** |
| Stars | 2 |
| Stack | R3F, Rapier Physics |

Rapier-based car controller with vehicle physics — perfect stack match, but no license means we cannot legally reuse any code.

---

### 6. DanieloM83/R3F-Car-Racing ❌ **Cannot use**

| Field | Value |
|---|---|
| Repo | https://github.com/DanieloM83/R3F-Car-Racing |
| License | **NO LICENSE** |
| Stars | 1 |
| Stack | R3F, Cannon.js |

R3F + Cannon.js car demo. No license, 2 years stale. Rejected.

---

## Recommendation

**Use both pmndrs/racing-game and colyseus/react-racing-game as reference + extraction source.**

Since `colyseus/react-racing-game` IS `pmndrs/racing-game` + Colyseus, we have a single lineage:
```
pmndrs/racing-game (base game) → colyseus/react-racing-game (+multiplayer)
```

**What to extract from pmndrs/racing-game (the game engine):**
1. Car physics controller — the core `useFrame` movement loop
2. Camera follow system — chase cam with smooth lerp
3. Track loading — how they load/position track models
4. Race HUD components — speed, lap, position display

**What to extract from colyseus/react-racing-game (the multiplayer layer):**
1. Colyseus room schema (TypeScript state definitions)
2. Matchmaking/lobby room handlers
3. Player sync (position, rotation, velocity broadcast)
4. Race lifecycle: lobby → ready → countdown → start → position updates → finish → results

**What stays from our code (untouched):**
- Next.js App Router (/race, /garage, /)
- Wallet connect / Solana integration
- Supabase player data, Race Cash, car ownership
- Car IDs, real model names, config system
- `resolveCarGameplayStats` — already integrates upgrade levels with stats
- Asset pipeline (Draco-compressed GLBs under `public/models/`)
- Garage/showroom architecture
- Payment/token verification APIs

**What gets adapted/integrated:**
- Our `CarGameplayStats` → feed into the extracted car physics controller (replaces their hardcoded car stats)
- Our `CarConfig + PlayerCar` → replace their car list
- Our car models → drop into their track/car loading component
- Our `RaceScene` → enhanced with physics movement + camera follow

---

## Integration Plan (5 phases)

### Phase 1: Extract car physics controller
- Study `pmndrs/racing-game` car controller (`src/models/` vehicle components)
- Port the `useFrame`-based movement loop into our `RaceScene`
- Feed our `CarGameplayStats` (maxSpeed, acceleration, steering, drift, etc.) into the controller
- Wire keyboard input (Arrow keys, Space, Shift for nitro/drift)
- Test: car moves with arrow keys in /race

### Phase 2: Extract camera follow system
- Study pmndrs/racing-game camera component
- Port 3rd-person chase camera with smooth follow, speed-FOV, nitro shake
- Replace current OrbitControls with game camera when driving
- Config: cameraDistance, height, followSmoothness from our planned camera config
- Test: camera follows car smoothly during driving

### Phase 3: Set up Colyseus server
- Create `/server/` directory at project root
- Reference `colyseus/react-racing-game` server structure
- Define room schemas: RaceRoom, PlayerState
- Implement: lobby → join → ready → countdown → start
- Run Colyseus on separate port (e.g., 2567) on same VPS
- Test: 2 browser tabs can join same room

### Phase 4: Multiplayer sync
- Port position/rotation/velocity sync from Colyseus racing game
- Interpolation on client side for smooth remote players
- Server validates: checkpoint order, lap completion, finish time
- Race results → saved to Supabase via our existing API

### Phase 5: Polish + matchmaking
- Matchmaking queue (join queue → auto-fill room 2-6 players)
- Race mode selection (Free/Cash/Premium) with entry fee deduction
- Race Cash rewards calculated and credited after race
- HUD enhancements (position tracker, minimap, nitro meter)

---

## Technical Notes

**Why not fork the whole repo?**
- pmndrs/racing-game is Vite-based; we're Next.js
- The game code is tightly coupled to its own asset pipeline and state management
- Extracting specific modules keeps our architecture clean and lets us integrate with our existing systems (wallet, Supabase, economy)

**Why not use MankyDanky/web-racing as base?**
- Django backend (Python) vs our Node.js/TypeScript stack
- WebRTC P2P (no server authority — weak anti-cheat)
- Ammo.js is heavier than Rapier; we'd need to port to Rapier anyway
- Plain JS (not React) — harder to integrate with our R3F components
- BUT: excellent reference for checkpoint/lap validation logic and race flow

**Why Colyseus over WebRTC/P2P?**
- Server-authoritative (better anti-cheat foundation)
- Room state management built-in
- Matchmaking infrastructure ready
- Scales horizontally for production
- Already authenticated via wallet (room can verify wallet before join)

---

## Estimated Implementation Steps

1. **Clone + study** pmndrs/racing-game and colyseus/react-racing-game locally (30 min)
2. **Extract car controller** — port to our RaceScene (2-3 hours)
3. **Extract camera** — port chase cam (1-2 hours)
4. **Colyseus server** — create `/server/` with room schema (2-3 hours)
5. **Multiplayer sync** — position broadcast + interpolation (3-4 hours)
6. **Integrate economy** — connect Race Cash rewards to race results (1-2 hours)

Total estimate: 12-16 hours for MVP multiplayer racing loop.

---

## Risks / Blockers

1. **pmndrs/racing-game code complexity** — may take time to understand the physics controller; some code may be tightly coupled to their state store
2. **Colyseus version drift** — colyseus/react-racing-game may use older Colyseus APIs; check compatibility with latest Colyseus
3. **Car physics feel** — porting physics from one system to another may require tuning; our `resolveCarGameplayStats` values may need adjustment after testing
4. **Asset scale mismatches** — pmndrs uses their own car models at specific scales; our Box3-normalized models may need position/camera adjustments
5. **Colyseus hosting** — needs a persistent process (not serverless); Railway / Fly.io / Render are the planned hosts
