import { NextResponse } from "next/server";

export async function GET() {
  const devToolsEnabled = process.env.DEV_TOOLS_ENABLED === "true";
  const devWalletAddress = devToolsEnabled ? (process.env.DEV_WALLET_ADDRESS || "") : "";

  return NextResponse.json({
    devToolsEnabled,
    devWalletAddress,
  });
}
