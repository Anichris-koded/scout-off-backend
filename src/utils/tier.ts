import { ProgressLevel } from '../types';

// Localization keys — swap values for translated strings when i18n is wired up.
const TIER_META: Record<ProgressLevel, { tierName: string; tierDescription: string }> = {
  0: {
    tierName: 'tier.0.name',
    tierDescription: 'tier.0.description',
  },
  1: {
    tierName: 'tier.1.name',
    tierDescription: 'tier.1.description',
  },
  2: {
    tierName: 'tier.2.name',
    tierDescription: 'tier.2.description',
  },
  3: {
    tierName: 'tier.3.name',
    tierDescription: 'tier.3.description',
  },
};

const FALLBACK_TIER = {
  tierName: 'tier.unknown.name',
  tierDescription: 'tier.unknown.description',
};

export function getTierMeta(level: number): { tierName: string; tierDescription: string } {
  return TIER_META[level as ProgressLevel] ?? FALLBACK_TIER;
}
