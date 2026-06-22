const isExplicitlyTrue = (value: string | undefined) => value === "true";

const DEFAULT_FRONTEND_SOLANA_RPC = "https://solana-rpc.publicnode.com";
const solanaRpc = process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() || DEFAULT_FRONTEND_SOLANA_RPC;

export const publicEnv = {
  solanaRpc,
  tokenMint: process.env.NEXT_PUBLIC_TOKEN_MINT || "",
  tokenDecimals: Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || 6),
  treasuryWallet: process.env.NEXT_PUBLIC_TREASURY_WALLET || "",
  tokenBuyUrl: process.env.NEXT_PUBLIC_TOKEN_BUY_URL || "https://pump.fun/",
  gameName: process.env.NEXT_PUBLIC_GAME_NAME || "Race Cash Rally",
  mockTokenMode: isExplicitlyTrue(process.env.NEXT_PUBLIC_MOCK_TOKEN_MODE),
  devToolsEnabled: isExplicitlyTrue(process.env.NEXT_PUBLIC_DEV_TOOLS_ENABLED),
  gameServerUrl: process.env.NEXT_PUBLIC_GAME_SERVER_URL || "",
};

export const serverEnv = {
  devToolsEnabled: isExplicitlyTrue(process.env.DEV_TOOLS_ENABLED),
  devWalletAddress: process.env.DEV_WALLET_ADDRESS || "",
};
