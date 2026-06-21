# Racete Economy: Race Cash Rewards and Token Stake Rooms

## Currency separation

- **Race Cash (RC)** is off-chain in-game currency stored in Supabase.
- **$RACETE / Pump.fun SPL token** is the on-chain token used later for token stake matchmaking and premium actions.
- Race Cash rewards are never on-chain token payouts.
- Token stake pot payouts are separate from Race Cash rewards.

## Mode behavior

### Solo Race

- No on-chain token stake.
- Rewards off-chain Race Cash only.
- V1 formula:
  - Finish: `+50 RC`
  - Best lap bonus: `+10 RC`
  - Clean race bonus: `+10 RC`
  - Fast finish bonus: `+5 RC`
  - Solo cap: `75 RC`

### Free Multiplayer Race

- No on-chain token stake.
- Every player earns off-chain Race Cash based on server-verified placement.
- V1 6-player placement rewards:
  - 1st: `+300 RC`
  - 2nd: `+220 RC`
  - 3rd: `+160 RC`
  - 4th: `+100 RC`
  - 5th: `+60 RC`
  - 6th: `+40 RC`

### Token Stake Race — future, disabled in V1 UI

- Players will deposit $RACETE into an on-chain stake pot later.
- Top finishers receive on-chain pot payout.
- All players still earn off-chain Race Cash based on placement.
- Token staking is currently **coming soon**: no real SPL transfer, escrow, payout, or treasury signer is implemented here.

Example stake tier preview:

- Stake: `100 $RACETE × 6 players = 600 $RACETE pool`

Future on-chain pot payout split:

- 1st: `40%` = `240 $RACETE`
- 2nd: `25%` = `150 $RACETE`
- 3rd: `15%` = `90 $RACETE`
- 4th: `10%` = `60 $RACETE`
- Platform fee: `10%` = `60 $RACETE`
- 5th: `0%`
- 6th: `0%`

Race Cash rewards still apply in token stake rooms:

- 1st: `+300 RC`
- 2nd: `+220 RC`
- 3rd: `+160 RC`
- 4th: `+100 RC`
- 5th: `+60 RC`
- 6th: `+40 RC`

## Server-authoritative requirements

- Multiplayer Race Cash placement rewards must be awarded from server-verified race results.
- Future on-chain pot payouts must happen only after server-authoritative race finalization.
- The client must never be trusted to claim multiplayer placement rewards or on-chain token payouts directly.
- Current `/api/race/reward` intentionally rejects client-only multiplayer claims until server authority is wired.

## Relevant config

- `src/config/rewards.ts`
  - solo Race Cash rewards
  - multiplayer Race Cash placement rewards
- `src/config/stake-races.ts`
  - future token stake tiers
  - future on-chain pot payout percentages
  - platform fee percentage
