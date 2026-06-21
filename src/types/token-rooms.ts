export type TokenStakeAmount = 1_000 | 5_000 | 10_000 | 25_000;

export type TokenRoomStatus =
  | "created"
  | "depositing"
  | "locked"
  | "racing"
  | "finalizing"
  | "manual_review"
  | "payout_pending"
  | "paid"
  | "refund_pending"
  | "refunded"
  | "cancelled"
  | "expired"
  | "payout_failed";

export type TokenRoomPlayerStatus =
  | "invited"
  | "joining"
  | "deposit_pending"
  | "deposit_confirmed"
  | "ready"
  | "racing"
  | "finished"
  | "dnf"
  | "disconnected"
  | "disqualified"
  | "refunded"
  | "manual_review";

export type TokenDepositStatus =
  | "intent_created"
  | "signature_submitted"
  | "confirmed"
  | "rejected"
  | "expired"
  | "refunded"
  | "manual_review";

export type TokenPayoutStatus =
  | "planned"
  | "pending"
  | "sent"
  | "confirmed"
  | "failed"
  | "cancelled"
  | "manual_review";

export type TokenRefundStatus =
  | "requested"
  | "pending"
  | "sent"
  | "confirmed"
  | "failed"
  | "rejected"
  | "manual_review";

export type WeeklyTokenSnapshotStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "manual_payout_in_progress"
  | "paid"
  | "void";

export type WeeklyTokenManualPayoutStatus =
  | "not_required"
  | "pending"
  | "sent"
  | "confirmed"
  | "blocked"
  | "under_review";

export type TokenPayoutType =
  | "player"
  | "weekly_reward_pool"
  | "treasury_fee"
  | "manual_adjustment";

export type TokenRoom = {
  id: string;
  roomId: string;
  raceId: string | null;
  serverRoomId: string | null;
  serverRaceId: string | null;
  tokenMint: string;
  stakeAmount: number;
  stakeAmountBaseUnits: string;
  stakeDecimals: number;
  stakePreset: TokenStakeAmount;
  creatorWalletAddress: string;
  minPlayers: number;
  maxPlayers: number;
  confirmedPlayerCount: number;
  status: TokenRoomStatus;
  vaultTokenAccount: string | null;
  vaultAuthorityType: "server_wallet" | "program_escrow" | "manual";
  creatorFeeBps: number;
  weeklyRewardBps: number;
  treasuryFeeBps: number;
  playerPayoutBps: number;
  confirmedPoolAmount: string;
  weeklyRewardAmount: string;
  treasuryFeeAmount: string;
  playerPayoutPoolAmount: string;
  payoutTotalAmount: string;
  refundTotalAmount: string;
  resultHash: string | null;
  antiCheatSummary: Record<string, unknown>;
  manualReviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  lockedAt: string | null;
  startedAt: string | null;
  finalizedAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
};

export type TokenRoomPlayer = {
  id: string;
  roomId: string;
  raceId: string | null;
  walletAddress: string;
  isCreator: boolean;
  status: TokenRoomPlayerStatus;
  depositStatus: TokenDepositStatus;
  depositId: string | null;
  stakeAmount: string;
  tokenMint: string;
  placement: number | null;
  eligibleForPayout: boolean;
  payoutRank: number | null;
  payoutAmount: string;
  refundAmount: string;
  finalRaceStatus: "finished" | "dnf" | "disconnected" | "disqualified" | null;
  finishTimeMs: number | null;
  bestLapMs: number | null;
  firstLapMs: number | null;
  lapsCompleted: number;
  checkpointsCompleted: number;
  suspiciousEvents: number;
  speedViolations: number;
  teleportViolations: number;
  checkpointViolations: number;
  outOfOrderViolations: number;
  dqReason: string | null;
  joinedAt: string;
  depositConfirmedAt: string | null;
  readyAt: string | null;
  finishedAt: string | null;
  leftAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TokenDeposit = {
  id: string;
  joinIntentId: string | null;
  roomId: string;
  walletAddress: string;
  tokenMint: string;
  stakeAmount: string;
  sourceTokenAccount: string | null;
  destinationTokenAccount: string | null;
  vaultTokenAccount: string | null;
  depositSignature: string | null;
  signatureStatus: string | null;
  slot: number | null;
  blockTime: string | null;
  confirmationLevel: string | null;
  status: TokenDepositStatus;
  verificationError: string | null;
  rawVerification: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  confirmedAt: string | null;
  expiresAt: string;
};

export type TokenPayout = {
  id: string;
  roomId: string;
  raceId: string | null;
  walletAddress: string | null;
  recipientWalletAddress: string;
  tokenMint: string;
  amount: string;
  payoutType: TokenPayoutType;
  placement: number | null;
  payoutRank: number | null;
  status: TokenPayoutStatus;
  idempotencyKey: string;
  payoutSignature: string | null;
  signatureStatus: string | null;
  slot: number | null;
  blockTime: string | null;
  failureReason: string | null;
  retryCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  plannedAt: string;
  sentAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
};

export type TokenRefund = {
  id: string;
  roomId: string;
  walletAddress: string;
  depositId: string | null;
  tokenMint: string;
  amount: string;
  reason: string;
  status: TokenRefundStatus;
  idempotencyKey: string;
  refundSignature: string | null;
  signatureStatus: string | null;
  slot: number | null;
  blockTime: string | null;
  failureReason: string | null;
  retryCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  requestedAt: string;
  sentAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
};

export type WeeklyTokenSnapshot = {
  id: string;
  weekId: string;
  weekStart: string;
  weekEnd: string;
  tokenMint: string;
  weeklyRewardWallet: string;
  snapshotStatus: WeeklyTokenSnapshotStatus;
  totalWeeklyPoolAmount: string;
  totalTokenRoomCount: number;
  totalTokenVolume: string;
  eligiblePlayerCount: number;
  blockedPlayerCount: number;
  snapshotHash: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
};

export type WeeklyTokenSnapshotEntry = {
  id: string;
  snapshotId: string;
  walletAddress: string;
  rank: number;
  tokenRoomWins: number;
  tokenRoomPodiums: number;
  tokenRoomsFinished: number;
  tokenRoomsEntered: number;
  tokenRoomWinRate: number;
  netTokenProfit: string;
  grossTokenWon: string;
  grossTokenStaked: string;
  suspiciousEventCount: number;
  disqualificationCount: number;
  payoutEligible: boolean;
  suggestedPayoutAmount: string;
  manualPayoutStatus: WeeklyTokenManualPayoutStatus;
  manualPayoutSignature: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};
