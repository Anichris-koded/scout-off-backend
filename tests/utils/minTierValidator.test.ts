import { validateMinTier } from '../../src/utils/minTierValidator';

describe('validateMinTier', () => {
  it('accepts valid tiers 0-3', () => {
    for (const t of [0, 1, 2, 3]) {
      const result = validateMinTier(t);
      expect(result.valid).toBe(true);
      expect(result.tier).toBe(t);
    }
  });

  it('accepts string representations of valid tiers', () => {
    const result = validateMinTier('2');
    expect(result.valid).toBe(true);
    expect(result.tier).toBe(2);
  });

  it('accepts boundary string values 0 and 3', () => {
    expect(validateMinTier('0')).toEqual({ valid: true, tier: 0 });
    expect(validateMinTier('3')).toEqual({ valid: true, tier: 3 });
  });

  it('accepts whitespace-padded string values', () => {
    expect(validateMinTier(' 1 ')).toEqual({ valid: true, tier: 1 });
  });

  it('returns valid with no tier when value is absent', () => {
    expect(validateMinTier(undefined)).toEqual({ valid: true });
    expect(validateMinTier(null)).toEqual({ valid: true });
    expect(validateMinTier('')).toEqual({ valid: true });
    expect(validateMinTier('   ')).toEqual({ valid: true });
  });

  it('rejects out-of-range values', () => {
    const result = validateMinTier(4);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/out of range/);
    expect(result.error).toMatch(/0, 1, 2, 3/);
  });

  it('rejects negative values', () => {
    const result = validateMinTier(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/out of range/);
  });

  it('rejects non-numeric strings', () => {
    const result = validateMinTier('gold');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/integer/);
    expect(result.error).toMatch(/0, 1, 2, 3/);
  });

  it('rejects string float values', () => {
    const result = validateMinTier('1.5');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/integer/);
  });

  it('rejects exponential string values', () => {
    const result = validateMinTier('1e1');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/integer/);
  });

  it('rejects hexadecimal string values', () => {
    const result = validateMinTier('0x2');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/integer/);
  });

  it('rejects float values', () => {
    const result = validateMinTier(1.5);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/integer/);
  });
});
