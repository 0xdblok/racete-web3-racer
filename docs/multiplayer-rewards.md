# Multiplayer Rewards — Architecture & Anti-Cheat Notes

## Current State (V1)

Multiplayer rewards are **disabled**. Client-claimed rewards are rejected with 403.

```
POST /api/race/reward with raceMode="multiplayer"
→ 403 "Multiplayer rewards require server-authoritative results"
```

This is correct for V1. Only solo races earn Race Cash.

---

## V1 Multiplayer Limitations

### Movement
- **Client-reported**: Each client sends their car position/speed at 15Hz
- **Server validates basic bounds**: x/y/z clamped to track extents, speed capped at 350
- **No checkpoint validation**: Server does not verify checkpoint order or lap completion
- **No finish validation**: Any client can claim any finish time

### Anti-Cheat Gaps
- Speed hacking: client can send any speed up to 350 (generous cap)
- Teleport: clamped to track bounds but can jump within them
- Fake finishes: no server-side lap/checkpoint tracking
- Time manipulation: finish time is client-reported
- Position spoofing: client can claim any position on track

---

## Future V2: Server-Authoritative Rewards

### Requirements Before Enabling Multiplayer Payouts

1. **Server-side checkpoint tracking**
   - Server validates checkpoint order
   - Transition detection (entry zone → exit zone)
   - Lap counting verified server-side

2. **Server-side finish validation**
   - Server confirms all checkpoints passed in order
   - Server confirms correct lap count
   - Finish time computed server-side (raceStartedAt → finishDetected)

3. **Plausibility checks**
   - Total time must exceed theoretical minimum
   - Checkpoint segment times must be plausible
   - No teleport between non-adjacent checkpoints

4. **Server-signed results**
   - Server produces a signed result object
   - Reward API only accepts server-signed payloads
   - Signature verified against server's public key

### Recommended Approach

Option A: **Colyseus authoritative mode**
- Server runs the physics simulation
- Clients send inputs (throttle, steer, nitro)
- Server broadcasts authoritative state
- Anti-cheat is inherent (server owns the truth)

Option B: **Server validation of client reports**
- Server validates checkpoint/lap/finish from client movement stream
- Lighter weight than full simulation
- Still vulnerable to sophisticated cheating

For V2, Option A is recommended for token prize pools. Option B may suffice for Race Cash only.

---

## Reward System (Future)

When server-authoritative results are implemented:

1. Server computes finish order (placement)
2. Server signs a result payload: `{ placement, trackId, raceClass, playerResults[] }`
3. Client submits signed payload to `POST /api/race/reward`
4. API verifies server signature
5. API pays Race Cash by placement using `MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS`

### Placement Reward Table (already configured)
| Placement | Race Cash |
|-----------|-----------|
| 1st | +300 RC |
| 2nd | +220 RC |
| 3rd | +160 RC |
| 4th | +100 RC |
| 5th | +60 RC |
| 6th | +40 RC |

---

## Token Stake Race (Future)

Token Stake Race remains "Coming Soon" in the UI. When implemented:

- On-chain escrow for token stakes
- Platform takes a fee from the stake pool
- Winner-takes-most payout
- Still earns Race Cash by placement (off-chain)
- Requires stronger anti-cheat than Free Race

No timeline set for token stake implementation.
