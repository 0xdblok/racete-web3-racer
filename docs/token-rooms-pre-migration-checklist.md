# Token Stake Rooms — Pre-Migration Readiness Checklist

Status: **Phase B.3 — docs + safety validation, no migration applied yet**

## Current Safe State

Token Stake Rooms are disabled and safe:

- `TOKEN_STAKE_ROOMS_ENABLED=*** `TOKEN_STAKE_ROOMS_TEST_MODE=*** All deposit/payout/transfer APIs return 403
- UI shows read-only test token balance only
- No on-chain write operations exist
- No signer/private key logic exists
- Race Cash and multiplayer rewards are untouched

## Migration File

- **Path:** `supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql`
- **Status:** Created, validated, **NOT applied**
- **Created:** Phase A foundation
- **Contains:** DDL for 9 tables (`token_rooms`, `token_room_players`, `token_deposits`, `token_payouts`, `token_refunds`, `token_room_events`, `weekly_token_snapshots`, `weekly_token_snapshot_entries`, `weekly_token_manual_payouts`) plus indexes, constraints, RLS

## How to Apply the Migration (Later)

When ready to apply (before Phase C):

### Option 1: Supabase SQL Editor (recommended for manual control)

1. Open Supabase Dashboard → SQL Editor
2. Copy the full contents of `supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql`
3. Paste into a new SQL query
4. Review the SQL (confirm no unintended changes to existing tables)
5. Run the query
6. Verify in Table Editor that all 9 new tables appear under `public` schema

### Option 2: `psql` with direct DB URL

```bash
psql "postgresql://..." < supabase/migrations/20260621150000_add_token_stake_rooms_phase_a.sql
```

Requires: Postgres DB URL with password (connection pooler URL is insufficient).

### Option 3: `supabase db push` (if CLI linked)

```bash
supabase db push --linked
```

Requires: `SUPABASE_ACCESS_TOKEN` set and project linked.

### What NOT to use

- `supabase-js` service-role REST key — PostgREST cannot run DDL
- Any API route call — the Next.js backend has no migration-running endpoint

## Post-Migration Verification

After applying the migration:

```
1. Open Supabase Table Editor
2. Confirm these tables exist under public schema:
   - token_rooms
   - token_room_players
   - token_deposits
   - token_payouts
   - token_refunds
   - token_room_events
   - weekly_token_snapshots
   - weekly_token_snapshot_entries
   - weekly_token_manual_payouts

3. Confirm RLS is enabled on all 9 tables
4. Confirm indexes exist for room_id, wallet_address, status, week_start
5. Run a test SELECT:
   SELECT count(*) FROM token_rooms;
   → Should return 0 (no rows, table exists and is empty)
```

## Rollback Notes

If migration must be rolled back:

```sql
DROP TABLE IF EXISTS
  weekly_token_manual_payouts,
  weekly_token_snapshot_entries,
  weekly_token_snapshots,
  token_room_events,
  token_refunds,
  token_payouts,
  token_deposits,
  token_room_players,
  token_rooms
CASCADE;
```

⚠ **CASCADE required** because of foreign key references. This will also drop any related data. Run this only if no token room data has been written.

## Critical Warnings

### ⚠ Applying the migration does NOT enable token rooms

The migration creates empty tables and RLS policies. Token Stake Rooms remain disabled via:
- `TOKEN_STAKE_ROOMS_ENABLED=*** in config
- All API routes returning 403
- All UI buttons disabled
- No deposit/transfer/payout code

The migration is purely infrastructure — it enables Phase C to write deposit records, not to accept deposits.

### ⚠ Phase C must NOT start before migration is applied

Phase C deposit verification code reads/writes `token_rooms` and `token_deposits` tables. Running Phase C routes without the migration would cause:
- PGRST205 / "relation does not exist" errors
- Failed deposit confirmations
- Users unable to join rooms

### ⚠ Applying the migration must not enable deposits

After migration is applied, verify that:
- `npm run check:token-rooms-safety` still passes (feature flags unchanged)
- `curl -X POST http://localhost:3000/api/token-rooms/create` still returns 403
- `/race/multiplayer` still shows disabled buttons
- No deposit code has been added

### ⚠ Migration is idempotent (uses IF NOT EXISTS)

The migration uses `CREATE TABLE IF NOT EXISTS` — safe to run multiple times without errors. Running it again will not duplicate tables or fail.
