import { ProgressLevel } from '../types';

const VALID_TIERS: ProgressLevel[] = [0, 1, 2, 3];
const VALID_TIERS_STR = VALID_TIERS.join(', ');

export interface TierValidationResult {
  valid: boolean;
  tier?: ProgressLevel;
  error?: string;
}

/**
 * Validates and normalises a raw minTier query parameter.
 * Returns the parsed ProgressLevel on success, or an error message on failure.
 */
export function validateMinTier(raw: unknown): TierValidationResult {
  if (raw === undefined || raw === null || raw === '') {
    return { valid: true }; // optional param — absence is fine
  }

  const num = Number(raw);

  if (!Number.isInteger(num) || isNaN(num)) {
    return {
      valid: false,
      error: `minTier must be an integer. Valid values: ${VALID_TIERS_STR}.`,
    };
  }

  if (!VALID_TIERS.includes(num as ProgressLevel)) {
    return {
      valid: false,
      error: `minTier ${num} is out of range. Valid values: ${VALID_TIERS_STR}.`,
    };
  }

  return { valid: true, tier: num as ProgressLevel };
}
