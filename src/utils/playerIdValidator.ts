// Player ID validation utility
/**
 * Expected playerId format: non-empty trimmed string. Adjust regex as needed for actual format.
 */
export function isValidPlayerId(id: string): boolean {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return trimmed.length > 0; // simple non‑empty validation
}
