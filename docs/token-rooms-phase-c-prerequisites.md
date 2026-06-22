# Token Stake Rooms — Phase C Prerequisites

Status: **Phase B.3 — documenting what must be true before Phase C starts**

## Phase C Summary (for context)

Phase C adds **deposit verification on devnet/local only**. It does NOT add mainnet deposits, token transfers initiated by the server, automatic payouts, or production token room gameplay. It is the first phase where on-chain deposit verification code touches the token_rooms DB tables.

## Mandatory Prerequisites

### 1. Supabase Migration Applied

- [ ] `supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql` applied
- [ ] All 9 tables visible in Supabase Table Editor
- [ ] RLS enabled on all 9 tables
- [ ] Indexes exist (room_id, wallet_address, status, week_start)
- [ ] `SELECT count(*) FROM token_rooms;` returns 0 (tables empty, ready)

### 2. Token Rooms Still Disabled

- [ ] `TOKEN_STAKE_ROOMS_ENABLED=*** in `src/config/token-rooms.ts`
- [ ] `TOKEN_STAKE_ROOMS_TEST_MODE=*** in `src/config/token-rooms.ts`
- [ ] `npm run check:token-rooms-safety` passes (14/14, exit 0)
- [ ] `npm run check:token-rooms` passes (safety + tsc, exit 0)
- [ ] All 6 token-room API POST routes return 403
- [ ] `/race/multiplayer` shows disabled buttons (Create, Join, Deposit)

### 3. Read-Only Balance UI Works

- [ ] `/race/multiplayer` loads without errors
- [ ] Connect wallet → "Test RACETE Balance" appears
- [ ] Click "Refresh balance" → balance updates
- [ ] Refresh balance does NOT trigger wallet signature popup
- [ ] "Last checked" timestamp updates on refresh
- [ ] Test-only warning visible: "This checks only the temporary test token."
- [ ] Disconnected wallet → "Connect wallet to check"
- [ ] Zero console errors on `/race/multiplayer`

### 4. Existing Multiplayer Still Works

- [ ] Free Multiplayer page loads on `/race/multiplayer`
- [ ] Matchmaking panel works
- [ ] Lobby works
- [ ] Race Cash multiplayer rewards unchanged
- [ ] No regression in solo races, missions, leaderboard, weekly, garage

### 5. Token Mint Configuration Confirmed

- [ ] `RACETE_TEST_TOKEN_MINT=26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump` in config
- [ ] `RACETE_TOKEN_MINT=TO_BE_PROVIDED_FINAL_PUMPFUN_MINT` placeholder in config
- [ ] Test mint is a valid Solana base58 public key
- [ ] No production mint set (placeholder remains)

### 6. Wallet Addresses Confirmed

- [ ] `TOKEN_TREASURY_WALLET=ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG` in config
- [ ] `TOKEN_WEEKLY_REWARD_WALLET=4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw` in config
- [ ] Both are valid Solana base58 public keys
- [ ] No private keys for these wallets exist in the codebase

### 7. Fee Configuration Correct

- [ ] `creatorFeeBps = 0`
- [ ] `weeklyRewardBps = 1500`
- [ ] `treasuryFeeBps = 500`
- [ ] `playerPayoutBps = 8000`
- [ ] Fee BPS sum = 10000
- [ ] Safety script verifies all above automatically

### 8. Safety Guards Pass

- [ ] No forbidden keywords in token-rooms files (`sendTransaction`, `transferChecked`, `Keypair.fromSecretKey`, `privateKey`, `payer`, etc.)
- [ ] Migration file exists at `supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql`
- [ ] API POST routes still return `tokenRoomDisabledResponse(...)`
- [ ] `TokenStakeRoomsPreview` contains "Production token rooms are not live" warning
- [ ] `package.json` has `check:token-rooms` script
- [ ] Safety script exit code 0 on all checks

### 9. Build & Typecheck Pass

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` succeeds
- [ ] No new TypeScript errors introduced
- [ ] Production build route listing includes all token-room API routes

### 10. Documentation Updated

- [ ] `docs/token-rooms-pre-migration-checklist.md` exists
- [ ] `docs/token-rooms-phase-c-prerequisites.md` exists (this file)
- [ ] `docs/token-rooms-phase-b-safety.md` up to date
- [ ] All docs reference current Phase B.3 status

## Before Starting Phase C Code

When ALL 10 sections above are checked:

1. Apply the migration (follow pre-migration checklist)
2. Verify tables exist in Supabase (post-migration checks)
3. Re-run `npm run check:token-rooms` — must still pass
4. Confirm all prerequisites still hold after migration
5. Begin Phase C deposit verification code

## If Any Check Fails

- **Do NOT start Phase C code**
- **Do NOT apply the migration** (if the failure is unrelated to migration)
- **Do NOT enable token rooms**
- Fix the failure, re-verify, then re-evaluate

## Automated Verification

Run the compound check before and after any changes:

```bash
npm run check:token-rooms
```

This runs all 14+ safety checks AND TypeScript typecheck in one pass. Any failure blocks Phase C progress.
