# Active Context

Current milestone: Car upgrades system

Completed:
- Added config-driven upgrade pricing and deterministic power-rating formula.
- Added `/api/cars/upgrade` for Race Cash-only upgrades.
- Extended payment intents with `actionType='upgrade_car'` and `upgrade_type`.
- Extended payment confirmation to apply premium upgrades after verified/mock token payment.
- Upgrade Race Cash spending uses purchased Race Cash first, then earned Race Cash.
- Upgrade ledger rows use negative amounts and preserve earned vs purchased cash type.
- Garage UI now shows owned-car upgrade levels, next-level costs, upgrade buttons, and insufficient balance messages.
- Verified API tests for Race Cash engine upgrade, premium mock engine upgrade, invalid type, unowned car, insufficient balance, max level, token transaction, power rating increase, and selected car preservation.

Next task:
- Add track catalog/unlock foundation or basic solo scene foundation, depending on next milestone.

Important files:
- `src/config/upgrades.ts`
- `src/lib/car-upgrades.ts`
- `src/app/api/cars/upgrade/route.ts`
- `src/app/api/payments/create-intent/route.ts`
- `src/app/api/payments/confirm/route.ts`
- `src/components/WalletGameDashboard.tsx`

Open blockers:
- Real SPL payment success still requires the actual Pump.fun token mint, treasury wallet, and funded user token account.
