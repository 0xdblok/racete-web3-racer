import { NextResponse } from "next/server";

function getDevWalletAddresses(): string[] {
  const wallets: string[] = [];
  const single = process.env.DEV_WALLET_ADDRESS?.trim();
  if (single) wallets.push(single);
  const multi = process.env.DEV_WALLET_ADDRESSES?.split(",") || [];
  for (const w of multi) {
    const trimmed = w.trim();
    if (trimmed) wallets.push(trimmed);
  }
  return wallets;
}

export async function GET() {
  const devToolsEnabled = process.env.DEV_TOOLS_ENABLED === "true";
  return NextResponse.json({
    devToolsEnabled,
    devWalletAddresses: devToolsEnabled ? getDevWalletAddresses() : [],
  });
}
