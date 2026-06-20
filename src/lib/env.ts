export const publicEnv = {
  solanaRpc: process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  tokenMint: process.env.NEXT_PUBLIC_TOKEN_MINT || "",
  tokenDecimals: Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || 6),
  treasuryWallet: process.env.NEXT_PUBLIC_TREASURY_WALLET || "",
  tokenBuyUrl: process.env.NEXT_PUBLIC_TOKEN_BUY_URL || "https://pump.fun/",
  gameName: process.env.NEXT_PUBLIC_GAME_NAME || "Race Cash Rally",
};
