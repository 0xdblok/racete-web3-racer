# Token Stake Rooms — Phase B Safety Guardrails

Status: **Phase B.3 — pre-migration readiness + safety validation**  
Last updated: 2026-06-21

## Current State

Token Stake Rooms are in **Phase B.3** — read-only test token balance display with manual refresh, automated safety guardrails, compound check workflow, and pre-migration readiness docs.

### What exists

- Config: `src/config/token-rooms.ts` with feature flags, fee BPS, wallet addresses, stake presets, payout split functions
- Types: `src/types/token-rooms.ts` with shared TypeScript types for room, player, deposit, payout, refund, and weekly snapshot entities
- API skeletons: 6 disabled routes under `src/app/api/token-rooms/` (all return 403 or 200-disabled)
- UI: `TokenStakeRoomsPreview` component showing disabled state + connected wallet test token balance with manual Refresh balance button and Last checked timestamp on `/race/multiplayer`
- Migration: `supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql` created but **not applied**
- Safety script: `scripts/check-token-rooms-safety.mjs` with 22 automated checks across 11 sections
- Compound check: `npm run check:token-rooms` runs safety checks + TypeScript typecheck in one command
- Pre-migration checklist: `docs/token-rooms-pre-migration-checklist.md`
- Phase C prerequisites: `docs/token-rooms-phase-c-prerequisites.md`

### Manual refresh behavior

The **Refresh balance** button in the Token Stake Rooms preview:

- Runs only the read-only `getParsedTokenAccountsByOwner` RPC call (same as auto-fetch on wallet connect).
- Does **not** trigger any transaction, token account creation, deposit, or wallet signature request.
- Reads the connected wallet's token accounts for `RACETE_TEST_TOKEN_MINT` and sums the `uiAmount`.
- Updates the "Last checked" timestamp after each successful fetch.
- Disabled when wallet is disconnected.
- Shows "Refreshing…" label while the RPC call is in-flight.

### What is explicitly disabled

- Token Stake Rooms feature flag: `TOKEN_STAKE_ROOMS_ENABLED=*** Test mode active: `TOKEN_STAKE_ROOMS_TEST_MODE=*** No deposits accepted (all deposit APIs return 403)
- No token transfers
- No token payouts
- No signer/private key logic
- No vault authority
- No on-chain write operations
- No token account creation (ATAs)
- No token room DB usage (migration not applied)
- No Race Cash reward modifications
- No current multiplayer reward modifications
- Creator fee: 0% (not implemented)
- Refresh balance button: read-only RPC, zero on-chain writes

### UI warnings

The Token Stake Rooms preview displays:

- "Read-only balance check. Token deposits are not enabled yet."
- "This checks only the temporary test token. Production token rooms are not live."
- Production mint shown as "Not provided yet" (not the raw placeholder string)

### Compound check workflow

```bash
npm run check:token-rooms
```

Runs `check:token-rooms-safety && npx tsc --noEmit` — a single command that verifies all 22 safety checks pass AND TypeScript compiles. Fails fast if either step fails.

### Safety script check sections

Run with: `npm run check:token-rooms-safety` — 22 checks across 11 sections:

1. **Feature Flags** (2 checks) — enabled=false, testMode=true
2. **Fee Configuration** (5 checks) — creator 0, weekly 1500, treasury 500, payout 8000, sum 10000
3. **Token Mint Configuration** (2 checks) — test mint correct, production mint is placeholder
4. **Wallet Configuration** (2 checks) — treasury + weekly reward wallets
5. **Stake Configuration** (3 checks) — min players 2, max players 6, decimals 6
6. **Forbidden Keyword Scan** (1 check) — 0 hits across 4 paths, 13 banned terms
7. **Migration File Check** (1 check) — migration file exists and contains expected DDL
8. **API Disabled Route Check** (4 checks) — create/confirm-deposit/join-intent/refund all use `tokenRoomDisabledResponse`
9. **UI Warning Text Check** (1 check) — "Production token rooms are not live" text present
10. **Package Script Check** (2 checks) — `check:token-rooms` and `check:token-rooms-safety` scripts exist

### Forbidden keywords scanned

The script scans these directories and fails if any of these strings appear:

- `sendTransaction`, `signTransaction`, `signAllTransactions`
- `transferChecked`, `createTransferInstruction`
- `createAssociatedTokenAccount`, `getOrCreateAssociatedTokenAccount`
- `Keypair.fromSecretKey`, `secretKey`, `privateKey`, `TOKEN_VAULT_PRIVATE_KEY`
- `payer`, `sendAndConfirmTransaction`

Scanned paths:

- `src/components/token-rooms/`
- `src/app/api/token-rooms/`
- `src/config/token-rooms.ts`
- `src/types/token-rooms.ts`

### Production token mint

| Variable | Value | Context |
|---|---|---|
| `RACETE_TEST_TOKEN_MINT` | `26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump` | Dev/test only |
| `RACETE_TOKEN_MINT` | `TO_BE_PROVIDED_FINAL_PUMPFUN_MINT` | Production placeholder |

The production mint remains a placeholder until the real Pump.fun SPL token mint address is provided. Dev/test token-room flows use `RACETE_TEST_TOKEN_MINT`. Production/mainnet flows must use `RACETE_TOKEN_MINT` only after the final mint is set.

## What Must Be True Before Phase C

Phase C adds deposit verification on devnet/local. Before Phase C code can be written:

1. Safety script passes with 0 failures (22/22)
2. TypeScript typecheck passes (`npx tsc --noEmit`)
3. Production build passes (`npm run build`)
4. Token room Supabase migration is reviewed and applied
5. Post-migration verification complete (tables visible, RLS enabled, indexes exist)
6. `TOKEN_STAKE_ROOMS_ENABLED` stays `false` for production builds
7. `TOKEN_STAKE_ROOMS_TEST_MODE` stays `true` for devnet flows
8. All deposit/transfer/payout code is gated behind the feature flag
9. No private keys or signer material are committed to the repo
10. Solana RPC endpoint is stable for devnet verification

See `docs/token-rooms-phase-c-prerequisites.md` for the full checklist.

## Running the Checks

```bash
# Safety checks only (22 checks across 11 sections)
npm run check:token-rooms-safety

# Safety checks + TypeScript typecheck
npm run check:token-rooms
```

Expected output: all checks green, exit code 0.

If any check fails, Token Stake Rooms MUST remain disabled and the violation MUST be resolved before proceeding to Phase C.

## Post-Deploy Manual Verification

After every deploy (including docs-only deploys), manually verify on the live deployed URL:

### Token Stake Rooms Preview

1. Open `/race/multiplayer`
2. Confirm Token Stake Rooms section is visible
3. Confirm "Coming Soon / Test Mode" badge is present
4. With wallet disconnected: "Connect wallet to check" is shown
5. Refresh balance button is disabled when wallet is off

### With Connected Wallet

6. Connect a Solana wallet
7. Confirm "Test RACETE Balance" appears with a balance value (or "0 TEST RACETE")
8. Click **Refresh balance**
9. Confirm no wallet signature popup appears (read-only RPC call only)
10. Confirm "Last checked" timestamp appears and updates
11. Confirm test-only warning is visible: "Production token rooms are not live."

### Disabled Action Buttons

12. Confirm "Create Token Room" button is disabled
13. Confirm "Join Token Room" button is disabled
14. Confirm "Deposit Disabled" button is disabled

### API Safety

15. Run in terminal or browser console:
    ```
    curl -X POST https://<deployed-url>/api/token-rooms/create
    ```
16. Confirm response is HTTP 403 with disabled message
17. Repeat for `/api/token-rooms/confirm-deposit`, `/join-intent`, `/refund`
18. Confirm `/api/token-rooms/available` returns 200 with `enabled: false`

### Console

19. Open browser DevTools → Console
20. Confirm zero errors on `/race/multiplayer`

### Other Pages

21. `/`, `/race`, `/garage`, `/missions`, `/leaderboard`, `/weekly` all load without errors
22. Free Multiplayer matchmaking/lobby still works
