# Multiplayer Rewards — Architecture & Anti-Cheat Notes

## Current State (V1.1 — Server-Authoritative Results)

Multiplayer rewards are **disabled**, but race results are now **server-authoritative**.

- Client sends `checkpoint {checkpointId}` and `finish {times}` events to Colyseus server
- Server validates checkpoint order, lap completion, and finish conditions
- Server assigns placement based on finish order
- Server broadcasts `race_results` to all clients when race ends
- `POST /api/race/reward` with `raceMode="multiplayer"` still returns 403

---

## V1.1 Architecture

### Server-Side (Colyseus RaceRoom)

```
Client → Server messages:
  - checkpoint { checkpointId }
  - finish { totalTimeMs, bestLapMs, firstLapMs }

Server validation:
  1. Checkpoint order: must be sequential (0→1→2→...→9→0→1→...)
  2. Lap completion: lap N only after completing all N-1 checkpoints
  3. Finish: only accepted after required laps (3 for City Loop)
  4. Minimum checkpoints: totalLaps × checkpointsPerLap must be met
  5. Time plausibility: totalTimeMs must exceed MIN_FINISH_TIME_MS (30s)
  6. Duplicate finish: rejected if already finished

Server → Client messages:
  - checkpoint_result { valid, checkpointId, currentLap, ... }
  - finish_result { accepted, placement, totalTimeMs, ... }
  - player_finished { sessionId, placement, totalTimeMs, ... }
  - player_dnf { sessionId }
  - race_results { results[] }
```

### Schema

```typescript
LobbyPlayer {
  // Race progress (server-authoritative)
  currentLap: number       // 1-based
  totalLaps: number        // 3 for City Loop
  checkpointIndex: number  // Next expected checkpoint (0-based order)
  checkpointsPassed: number
  startedAt: number        // Server timestamp
  finishedAt: number       // Server timestamp
  totalTimeMs: number      // finishedAt - startedAt
  bestLapMs: number
  firstLapMs: number
  placement: number        // Server-assigned (0 = not finished)
  raceStatus: "lobby" | "racing" | "finished" | "disconnected" | "dnf"
}

RaceResult {
  placement, walletAddress, displayWallet, carName, carClass
  totalTimeMs, bestLapMs, firstLapMs
  status: "finished" | "dnf"
}
```

### DNF / Timeout
- Player disconnects during race → marked as `disconnected` → included in results as DNF
- Max race duration: 10 minutes → remaining racers marked as `dnf` → race ends
- Room auto-disposes when empty after race completes

---

## Remaining Before Enabling Multiplayer Payouts

### Required
1. **Server-signed results** — Colyseus server produces a signed/hashed result payload that the reward API can verify
2. **Reward API integration** — `POST /api/race/reward` accepts server-signed multiplayer results
3. **Placement-based payouts** — Use `MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS` config

### Recommended
4. **Checkpoint geometry validation** — Server has checkpoint positions, validates proximity (currently only validates order)
5. **Speed/distance sanity** — Validate that checkpoint segment times are physically plausible
6. **No-teleport check** — Validate distance between consecutive positions is below max speed threshold

---

## Current Anti-Cheat Coverage

| Threat | V1.1 Protection |
|---|---|
| Fake finish time | ✓ Server computes time from startAt |
| Finish before laps | ✓ Server validates lap count |
| Out-of-order checkpoints | ✓ Server ignores out-of-order events |
| Duplicate finish | ✓ Rejected |
| Placement spoofing | ✓ Server-assigned |
| Disconnect griefing | ✓ Marked DNF, doesn't crash room |
| Speed hacking | ⚠️ Clamped to 350 but generous |
| Position spoofing | ⚠️ Clamped to track bounds |
| Wall clipping | ❌ No server-side physics |
| Stolen checkpoint credit | ⚠️ Order validated but no proximity check |

---

## Future V2: Full Server Authority

- Server runs physics simulation (or validates against it)
- Clients send inputs only (throttle, steer, nitro)
- Server broadcasts authoritative state
- Anti-cheat is inherent

---

## Token Stake Race (Future)

Token Stake Race remains "Coming Soon" in the UI. When implemented:

- On-chain escrow for token stakes
- Platform takes a fee from the stake pool
- Winner-takes-most payout
- Still earns Race Cash by placement (off-chain)
- Requires stronger anti-cheat than Free Race

No timeline set for token stake implementation.
