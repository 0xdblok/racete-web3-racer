# Active Context

Current milestone: Garage car purchases and selected car flow

Completed:
- Added `/api/cars/buy` for Race Cash-only car purchases.
- Added `/api/cars/select` for owned-car selection with one selected car per wallet.
- Extended `/api/payments/create-intent` with `actionType='buy_car'` for premium cars.
- Extended `/api/payments/confirm` so verified/mock token payment completes premium car purchase.
- Race Cash car spending uses backend car prices and spends purchased Race Cash before earned Race Cash.
- Car purchase ledger rows use negative amounts and preserve earned vs purchased cash type.
- Garage UI now shows locked/owned/selected state, buy/select buttons, prices, and insufficient balance messages.
- Verified API tests for Bavaro Race Cash buy, selected car update, duplicate rejection, insufficient balance rejection, and Sturm RS premium mock token buy.

Next task:
- Add upgrade levels and upgrade purchases using Race Cash-only low levels and Race Cash + token higher levels.

Important files:
- `src/app/api/cars/buy/route.ts`
- `src/app/api/cars/select/route.ts`
- `src/app/api/payments/create-intent/route.ts`
- `src/app/api/payments/confirm/route.ts`
- `src/lib/car-purchases.ts`
- `src/lib/player-state.ts`
- `src/components/WalletGameDashboard.tsx`

Open blockers:
- Real SPL payment success still requires the actual Pump.fun token mint, treasury wallet, and funded user token account.
