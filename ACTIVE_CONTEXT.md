# Active Context

Current milestone: Mock token payment mode for economy testing

Completed:
- Added explicit `MOCK_TOKEN_MODE` server env and `NEXT_PUBLIC_MOCK_TOKEN_MODE` client env.
- Kept real Solana SPL `TransferChecked` payment path intact for mainnet mode.
- Added backend mock confirmation path gated by `MOCK_TOKEN_MODE=true` only.
- Added frontend Dev mock payment mode UI and mock confirm flow that does not open wallet transaction.
- Mock Starter Pack test confirmed purchased Race Cash increases by 10,000 and earned Race Cash stays unchanged.
- Verified `token_transactions.status='mock_confirmed'` and ledger row uses purchased cash.
- Verified mock confirmation is rejected with 403 when server mock mode is disabled.

Next task:
- Use mock payment mode to build/test garage car purchases and upgrades before the real Pump.fun token exists.

Important files:
- `src/components/WalletGameDashboard.tsx`
- `src/app/api/payments/create-intent/route.ts`
- `src/app/api/payments/confirm/route.ts`
- `src/lib/env.ts`
- `src/lib/server-env.ts`
- `src/lib/solana-payments.ts`
- `src/config/economy.ts`
- `.env.example`

Open blockers:
- Real SPL payment success still requires the actual Pump.fun token mint, treasury wallet, and funded user token account.
