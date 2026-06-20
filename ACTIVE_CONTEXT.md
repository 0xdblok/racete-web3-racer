# Active Context

Current milestone: Wallet + Player Init foundation

Completed:
- Created Next.js App Router project with Tailwind.
- Installed Solana wallet adapter, web3.js, SPL token, and Supabase client.
- Inspected official/recommended repo options for Solana wallet patterns.

Next task:
- Wire wallet connect to `/api/player/init`, token balance lookup, balances, and garage.

Important files:
- `src/components/WalletGameDashboard.tsx`
- `src/components/SolanaWalletProvider.tsx`
- `src/app/api/player/init/route.ts`
- `src/config/cars.ts`
- `supabase/schema.sql`

Open blockers:
- Real Supabase env values and Pump.fun token mint/treasury must be configured before live testing against Supabase/Solana.
