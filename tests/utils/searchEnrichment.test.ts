import { enrichPlayerResult, EnrichedPlayerResult } from '../../src/utils/searchEnrichment';

describe('enrichPlayerResult', () => {
  it('returns correct progressLabel and verificationBadge for level 0', () => {
    const result = enrichPlayerResult(0);
    expect(result.progressLabel).toBe('Unverified');
    expect(result.verificationBadge).toBe('none');
  });

  it('returns correct fields for level 1 (Verified Identity)', () => {
    const result = enrichPlayerResult(1);
    expect(result.progressLabel).toBe('Verified Identity');
    expect(result.verificationBadge).toBe('identity_verified');
  });

  it('returns correct fields for level 2 (Performance Milestones)', () => {
    const result = enrichPlayerResult(2);
    expect(result.progressLabel).toBe('Performance Milestones');
    expect(result.verificationBadge).toBe('performance_verified');
  });

  it('returns correct fields for level 3 (Elite Tier)', () => {
    const result = enrichPlayerResult(3);
    expect(result.progressLabel).toBe('Elite Tier');
    expect(result.verificationBadge).toBe('elite');
  });

  it('returns fallback fields for unknown levels', () => {
    const result = enrichPlayerResult(99);
    expect(result.progressLabel).toBe('Unknown');
    expect(result.verificationBadge).toBe('none');
  });

  it('result conforms to EnrichedPlayerResult shape', () => {
    const result: EnrichedPlayerResult = enrichPlayerResult(1);
    expect(typeof result.progressLabel).toBe('string');
    expect(typeof result.verificationBadge).toBe('string');
  });
});
