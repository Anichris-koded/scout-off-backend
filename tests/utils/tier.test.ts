import { getTierMeta } from '../../src/utils/tier';
import { ProgressLevel } from '../../src/types';

describe('getTierMeta', () => {
  const levels: ProgressLevel[] = [0, 1, 2, 3];

  it.each(levels)('returns tierName and tierDescription for level %i', (level) => {
    const meta = getTierMeta(level);
    expect(typeof meta.tierName).toBe('string');
    expect(meta.tierName.length).toBeGreaterThan(0);
    expect(typeof meta.tierDescription).toBe('string');
    expect(meta.tierDescription.length).toBeGreaterThan(0);
  });

  it('uses localization key format for future i18n', () => {
    const meta = getTierMeta(0);
    expect(meta.tierName).toMatch(/^tier\.\d+\./);
    expect(meta.tierDescription).toMatch(/^tier\.\d+\./);
  });
});
