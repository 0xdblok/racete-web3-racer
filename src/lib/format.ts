export function shortWallet(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString();
}
