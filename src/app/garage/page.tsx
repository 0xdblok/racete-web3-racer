import { WalletGameDashboard } from "@/components/WalletGameDashboard";

export const dynamic = "force-dynamic";

export default function GaragePage() {
  const devToolsEnabled = process.env.NEXT_PUBLIC_DEV_TOOLS_ENABLED === "true";
  return <WalletGameDashboard devToolsEnabled={devToolsEnabled} />;
}
