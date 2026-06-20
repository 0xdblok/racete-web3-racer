# Active Context

Current milestone: Pump.fun token payment foundation

Completed:
- Confirmed git worktree clean before payment work.
- Confirmed GitHub repo `0xdblok/racete-web3-racer` exists and `main` is pushed.
- Confirmed `.env.local` and `/root/racete-secrets.env` are untracked; only `.env.example` is committed.
- Confirmed Vercel production env names exist for Supabase, Solana RPC, token mint/decimals, treasury, and buy URL.
- Added config-driven Race Cash packs.
- Added `/api/payments/create-intent` for backend-priced token payment intents.
- Added `/api/payments/confirm` with SPL transfer verification and purchased Race Cash accounting.
- Added frontend Race Cash shop with wallet SPL `TransferChecked` to treasury ATA.

Next task:
- Deploy payment foundation and test with a real token mint/treasury once the Pump.fun token exists.

Important files:
- `src/components/WalletGameDashboard.tsx`
- `src/app/api/payments/create-intent/route.ts`
- `src/app/api/payments/confirm/route.ts`
- `src/lib/solana-payments.ts`
- `src/config/economy.ts`
- `src/lib/env.ts`
- `src/lib/server-env.ts`
- `supabase/schema.sql`

Open blockers:
- Current token mint is still placeholder until the real Pump.fun SPL token is created.
- End-to-end successful payment requires wallet with the real token and treasury ATA creation/payment on-chain.
