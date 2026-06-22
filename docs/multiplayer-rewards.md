# Multiplayer Rewards — Architecture & Anti-Cheat Notes

## Current State (V2 — Server-Signed Rewards Enabled)

Multiplayer Race Cash rewards are now **enabled** via server-signed payloads.

- Colyseus server generates HMAC-SHA256 signed reward payloads for each finished player
- Frontend receives signed payload via `multiplayer_reward` WebSocket message
- Player clicks "Claim Multiplayer Reward" button
- Frontend POSTs signed payload to `POST /api/race/reward/multiplayer`
- API verifies signature using shared `MULTIPLAYER_REWARD_SECRET`
- API pays Race Cash based on placement (1st: 150 RC, 2nd: 100 RC, 3rd: 75 RC, 4th: 50 RC, 5th: 40 RC, 6th: 30 RC)
- DNF players get 0 RC and receive no signed payload
- Idempotency enforced via `multiplayer:{serverRaceId}:{walletAddress}`

---

## Security Model

### Signing (Server)
```
payload = { version, serverRaceId, walletAddress, placement, totalTimeMs, ... }
canonical = JSON.stringify(payload, Object.keys(payload).sort())
signature = HMAC-SHA256(canonical, MULTIPLAYER_REWARD_SECRET)
```

### Verification (API)
```
canonical = JSON.stringify(payload, Object.keys(payload).sort())
expected = HMAC-SHA256(canonical, MULTIPLAYER_REWARD_SECRET)
valid = constantTimeCompare(signature, expected)
```

### Additional API Checks
| Check | Purpose |
|---|---|
| Signature valid | Prevents forgery |
| expiresAt > now | Payload lifetime: 15 minutes |
| placement in [1,6] | Valid race placement |
| status === "finished" | No DNF payouts |
| totalTimeMs >= 30s | Minimum finish time |
| lapsCompleted >= 3 | Required City Loop laps |
| checkpointsCompleted >= 30 | Required checkpoints |
| idempotency (client_race_id) | No double payout |
| reward calculated server-side | Amount comes from config, not payload |

### Shared Secret
- `MULTIPLAYER_REWARD_SECRET` in server `.env` (Colyseus server on VPS)
- `MULTIPLAYER_REWARD_SECRET` in Vercel env vars (not `NEXT_PUBLIC_`!)
- Never sent to the browser

---

## API Endpoint

### POST /api/race/reward/multiplayer

Request body:
```json
{
  "payload": {
    "version": 1,
    "raceMode": "multiplayer",
    "serverRaceId": "mp:roomId:1234567890",
    "walletAddress": "...",
    "placement": 1,
    "totalTimeMs": 120000,
    ...
    "expiresAt": "2026-06-22T..."
  },
  "signature": "hex..."
}
```

Response (200):
```json
{
  "claimed": true,
  "placement": 1,
  "rewardAmount": 150,
  "newBalance": 5420
}
```

Errors: 400 (invalid), 403 (bad signature), 409 (already claimed), 410 (expired)

---

## Multiplayer Placement Rewards

| Placement | Race Cash |
|---|---|
| 1st | 150 RC |
| 2nd | 100 RC |
| 3rd | 75 RC |
| 4th | 50 RC |
| 5th | 40 RC |
| 6th | 30 RC |
| DNF | 0 RC |

---

## Anti-Cheat Coverage

| Threat | Protection |
|---|---|
| Forged reward payload | ✓ HMAC signature verification |
| Replay attack | ✓ Payload expires after 15 min |
| Double claim | ✓ Idempotency via client_race_id |
| DNF payout | ✓ Server only signs finished players |
| Placement spoofing | ✓ Server-assigned + verified in API |
| Client-side placement | ✓ Reward amount from server config, not payload |
| Expired claim | ✓ expiresAt checked |
| Missing secret | ✓ API returns 500 if secret not configured |

---

## Future V3: Full Server-Authoritative Physics

- Server runs physics simulation (or validates against it)
- Clients send inputs only (throttle, steer, nitro)
- Server broadcasts authoritative state
- Anti-cheat is inherent

---

## Token Stake Rooms (Future)

Token Stake Rooms remain **Coming Soon / Test Mode** and disabled. Current architecture rules:

- Multiplayer-only token stake rooms.
- No deposits, transfers, payouts, escrow, or signer logic is live.
- No Race Cash payout in Token Stake Rooms V1 unless explicitly redesigned later.
- Token accounting stays separate from Free Multiplayer Race Cash rewards.
- Current V1 economy preview: creator `0%`, weekly token reward pool `15%`, treasury `5%`, player payout pool `80%`.
- Supported V1 stake presets: `1,000 / 5,000 / 10,000 / 25,000 RACETE`.
- Requires stronger anti-cheat and payout review before any Phase C+ implementation.

No timeline set for live token stake implementation.
