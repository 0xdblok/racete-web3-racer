/**
 * Reusable race time formatting utilities.
 * Used across RaceHud, RaceResultsOverlay, MyRecordsPanel, and RewardProgressPanel.
 */

/** Format milliseconds to m:ss.ff (e.g. "2:05.83" or "0:38.10") */
export function formatRaceTime(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const fraction = Math.floor((safeMs % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${fraction
    .toString()
    .padStart(2, "0")}`;
}

/** Format a single lap time (shorter display, e.g. "38.10s" or "1:05.83") */
export function formatLapTime(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const fraction = Math.floor((safeMs % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${fraction
      .toString()
      .padStart(2, "0")}`;
  }
  return `${seconds}.${fraction.toString().padStart(2, "0")}s`;
}

/** Format the difference between two times (e.g. "+2.30s", "-1:05.00") */
export function formatDeltaTime(deltaMs: number): string {
  const absMs = Math.abs(Math.round(deltaMs));
  const sign = deltaMs < 0 ? "-" : "+";
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const fraction = Math.floor((absMs % 1000) / 10);
  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}.${fraction
      .toString()
      .padStart(2, "0")}`;
  }
  return `${sign}${seconds}.${fraction.toString().padStart(2, "0")}s`;
}
