/**
 * Weekly Competitions V1 — Prize Config
 *
 * NO auto-distribution in V1. This config defines the prize preview
 * shown on the /weekly page. Actual payouts will be manual admin
 * distribution in a future iteration.
 */

export interface WeeklyPrize {
  rank: number;
  label: string;
  rewardAmount: number;
}

export interface WeeklyCategoryPrizeConfig {
  title: string;
  description: string;
  prizes: WeeklyPrize[];
}

/**
 * Prize config per weekly category.
 * These are preview-only for V1 — no auto-payout.
 */
export const WEEKLY_PRIZES: Record<string, WeeklyCategoryPrizeConfig> = {
  best_total_time: {
    title: "Weekly Best Total Time",
    description: "Fastest total time on City Loop this week",
    prizes: [
      { rank: 1, label: "1st Place", rewardAmount: 2000 },
      { rank: 2, label: "2nd Place", rewardAmount: 1000 },
      { rank: 3, label: "3rd Place", rewardAmount: 500 },
    ],
  },
  best_first_lap: {
    title: "Weekly Best First Lap",
    description: "Fastest first lap on City Loop this week",
    prizes: [
      { rank: 1, label: "1st Place", rewardAmount: 1000 },
      { rank: 2, label: "2nd Place", rewardAmount: 500 },
      { rank: 3, label: "3rd Place", rewardAmount: 250 },
    ],
  },
  best_lap: {
    title: "Weekly Best Lap",
    description: "Fastest single lap on City Loop this week",
    prizes: [
      { rank: 1, label: "1st Place", rewardAmount: 1000 },
      { rank: 2, label: "2nd Place", rewardAmount: 500 },
      { rank: 3, label: "3rd Place", rewardAmount: 250 },
    ],
  },
  race_cash_earned: {
    title: "Weekly Race Cash Earned",
    description: "Most Race Cash earned from racing this week",
    prizes: [
      { rank: 1, label: "1st Place", rewardAmount: 1500 },
      { rank: 2, label: "2nd Place", rewardAmount: 750 },
      { rank: 3, label: "3rd Place", rewardAmount: 300 },
    ],
  },
  missions_completed: {
    title: "Weekly Missions Completed",
    description: "Most missions completed this week",
    prizes: [
      { rank: 1, label: "1st Place", rewardAmount: 1000 },
      { rank: 2, label: "2nd Place", rewardAmount: 500 },
      { rank: 3, label: "3rd Place", rewardAmount: 250 },
    ],
  },
  races_finished: {
    title: "Weekly Races Finished",
    description: "Most races finished this week",
    prizes: [
      { rank: 1, label: "1st Place", rewardAmount: 1000 },
      { rank: 2, label: "2nd Place", rewardAmount: 500 },
      { rank: 3, label: "3rd Place", rewardAmount: 250 },
    ],
  },
};
