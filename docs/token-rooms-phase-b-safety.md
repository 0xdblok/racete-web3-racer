# Token Stake Rooms — Phase B Safety Guardrails

Status: **Phase B.2 — read-only balance + UX polish + compound safety workflow**  
Last updated: 2026-06-21

## Current State

Token Stake Rooms are in **Phase B.2** — read-only test token balance display with manual refresh, automated safety guardrails, and compound check workflow.

### What exists

- Config: `src/config/token-rooms.ts` with feature flags, fee BPS, wallet addresses, stake presets, payout split functions
- Types: `src/types/token-rooms.ts` with shared TypeScript types for room, player, deposit, payout, refund, and weekly snapshot entities
- API skeletons: 6 disabled routes under `src/app/api/token-rooms/` (all return 403 or 200-disabled)
- UI: `TokenStakeRoomsPreview` component showing disabled state + connected wallet test token balance with **manual Refresh balance** button and **Last checked** timestamp on `/race/multiplayer`
- Migration: `supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql` created but **not applied**
- Safety script: `scripts/check-token-rooms-safety.mjs` runnable via `npm run check:token-rooms-safety`
- Compound check: `npm run check:token-rooms` runs safety checks + TypeScript typecheck in one command

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

Runs `check:token-rooms-safety && npx tsc --noEmit` — a single command that verifies all 14 safety checks pass AND TypeScript compiles. Fails fast if either step fails.

### What the safety script checks

Run with: `npm run check:token-rooms-safety`

| Check | Expected |
|---|---|
| `TOKEN_STAKE_ROOMS_ENABLED` | `false` |
| `TOKEN_STAKE_ROOMS_TEST_MODE` | `true` |
| `creatorFeeBps` | `0` |
| `weeklyRewardBps` | `1500` |
| `treasuryFeeBps` | `500` |
| `playerPayoutBps` | `8000` |
| Fee BPS sum | `10000` |
| `RACETE_TEST_TOKEN_MINT` | `44NFH6uvepYsCdqMBH8L7DKjgYYyoUmVsdksXXXLG1D8` |
| `RACETE_TOKEN_MINT` | `TO_BE_PROVIDED_FINAL_PUMPFUN_MINT` (placeholder) |
| `TOKEN_TREASURY_WALLET` | `ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG` |
| `TOKEN_WEEKLY_REWARD_WALLET` | `4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw` |
| `TOKEN_ROOM_MIN_PLAYERS` | `2` |
| `TOKEN_ROOM_MAX_PLAYERS` | `6` |
| `TOKEN_ROOM_DECIMALS` | `6` |
| Forbidden keywords scan | 0 hits across 4 scanned paths |

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
| `RACETE_TEST_TOKEN_MINT` | `44NFH6uvepYsCdqMBH8L7DKjgYYyoUmVsdksXXXLG1D8` | Dev/test only |
| `RACETE_TOKEN_MINT` | `TO_BE_PROVIDED_FINAL_PUMPFUN_MINT` | Production placeholder |

The production mint remains a placeholder until the real Pump.fun SPL token mint address is provided. Dev/test token-room flows use `RACETE_TEST_TOKEN_MINT`. Production/mainnet flows must use `RACETE_TOKEN_MINT` only after the final mint is set.

## What Must Be True Before Phase C

Phase C adds deposit verification on devnet/local. Before Phase C code can be written:

1. Safety script passes with 0 failures
2. TypeScript typecheck passes (`npx tsc --noEmit`)
3. Production build passes (`npm run build`)
4. Token room Supabase migration is reviewed and applied (or a dev-only DB is available)
5. `TOKEN_STAKE_ROOMS_ENABLED` stays `false` for production builds
6. `TOKEN_STAKE_ROOMS_TEST_MODE` stays `true` for devnet flows
7. All deposit/transfer/payout code is gated behind the feature flag
8. No private keys or signer material are committed to the repo
9. Solana RPC endpoint is stable for devnet verification

## Running the Checks

```bash
# Safety checks only
npm run check:token-rooms-safety

# Safety checks + TypeScript typecheck
npm run check:token-rooms
```

Expected output: all checks green, exit code 0.

If any check fails, Token Stake Rooms MUST remain disabled and the violation MUST be resolved before proceeding to Phase C.
