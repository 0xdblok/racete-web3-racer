# Weekly Competitions V1

## Overview

Weekly Competitions provide recurring competitive leaderboards that reset every Monday 00:00 UTC. Players compete for top rankings across multiple categories using Race Cash rewards (preview only in V1, manual admin distribution planned).

## Week Definition

- **Window**: Monday 00:00 UTC → next Monday 00:00 UTC (ISO 8601 weeks)
- **Week ID**: Format `YYYY-Www` (e.g., `2026-W26`)
- **Utilities**: `src/lib/weekly.ts`

## Categories

| Category | Sort | Data Source |
|---|---|---|
| **Best Total Time** | Asc (lower better) | `race_rewards` MIN(total_time_ms) |
| **Best First Lap** | Asc (lower better) | `race_rewards` reward_breakdown.firstLapMs |
| **Best Lap** | Asc (lower better) | `race_rewards` MIN(best_lap_ms) |
| **Race Cash Earned** | Desc (higher better) | `race_cash_ledger` SUM(amount) where amount>0, cash_type=earned |
| **Missions Completed** | Desc (higher better) | `race_objective_progress` COUNT where claimed_at in week |
| **Races Finished** | Desc (higher better) | `race_rewards` COUNT where status=paid |

## Data Sources

- `race_rewards` — For time categories and race counts (status=paid, race_mode=solo)
- `race_cash_ledger` — For Race Cash earned (includes race_reward: and objective: sources)
- `race_objective_progress` — For missions completed count
- `cars_catalog` — For car_id → class mapping

### Limitations

- `race_rewards` does not have a direct `car_class` column. Car class is inferred via `cars_catalog` join on `car_id`. When class filter is active and class doesn't match inferred class, the entry is excluded.
- Missions completed count uses `claimed_at` timestamp (not `completed_at`), since `completed_at` may not exist for one-time objectives that were claimed in previous weeks.
- No separate weekly leaderboard table — rankings are computed from existing event tables.

## API

### GET /api/weekly/leaderboard

Query params:
- `category` — One of: `best_total_time`, `best_first_lap`, `best_lap`, `race_cash_earned`, `missions_completed`, `races_finished`
- `trackId` — Default: `city-loop`
- `carClass` — `all` | `D` | `C` | `C+` | `B` | `B+` | `A` | `S`. Default: `all`
- `limit` — 10 | 25 | 50. Default: 10
- `weekId` — Optional. Format `2026-W26`. Default: current week
- `walletAddress` — Optional. Returns `currentPlayer` rank and entry

Response includes:
- `entries` — Ranked leaderboard entries
- `currentPlayer` — Player's rank and entry (null if not ranked)
- `prizes` — Prize preview for the selected category
- `distributionNote` — Clarifies V1 preview status

## Prize Config

Prizes are defined in `src/config/weekly.ts`. V1 shows a preview on the /weekly page and API response. No automatic distribution.

### Future Distribution Plan (V2+)
- Manual admin payout via SQL or admin dashboard
- Eventually: automated distribution using platform fee pool from token staking
- No token prizes in V1 — Race Cash only

## UI

- **Page**: `/weekly`
- **Components**: `WeeklyPageClient`, `WeeklyLeaderboardTable`, `WeeklyFilters`
- **Race Preview**: `WeeklyPreviewPanel` shown on `/race` before race starts
- **Nav Link**: "Weekly" added to all pages (Race, Garage, Missions, Leaderboard, Home)

## Security

- Server-side only — all rankings computed from Supabase admin queries
- Only `paid` race rewards count (impossible/duplicate/multiplayer are excluded)
- No client-side trust for rankings or payouts
- V1 does not auto-distribute rewards

## Files

```
src/lib/weekly.ts                              — Week utilities
src/config/weekly.ts                           — Prize config
src/app/api/weekly/leaderboard/route.ts        — API endpoint
src/app/weekly/page.tsx                        — Page entry
src/components/weekly/WeeklyPageClient.tsx     — Client component
src/components/weekly/WeeklyLeaderboardTable.tsx — Table
src/components/weekly/WeeklyFilters.tsx        — Filters
src/components/race/WeeklyPreviewPanel.tsx     — Race preview
```
