export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  solanaRpc: process.env.SOLANA_RPC_SERVER || process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  tokenMint: process.env.TOKEN_MINT || process.env.NEXT_PUBLIC_TOKEN_MINT || "",
  tokenDecimals: Number(process.env.TOKEN_DECIMALS || process.env.NEXT_PUBLIC_TOKEN_DECIMALS || 6),
  treasuryWallet: process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET || "",
};
