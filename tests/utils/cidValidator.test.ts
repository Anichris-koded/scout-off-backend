import { isValidCid, CID_REGEX } from '../../src/utils/cidValidator';

describe('isValidCid', () => {
  // CIDv0 examples — base58, starts with Qm, 46 chars
  it('accepts a valid CIDv0', () => {
    expect(isValidCid('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(true);
  });

  it('accepts another valid CIDv0', () => {
    expect(isValidCid('QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB')).toBe(true);
  });

  // CIDv1 examples — base32 prefix 'b'
  it('accepts a valid CIDv1 base32', () => {
    expect(isValidCid('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(true);
  });

  it('accepts a valid CIDv1 base58btc (z prefix)', () => {
    expect(isValidCid('zdj7WWeQ43G6JJvLWQWZpyHuAMq6uYWRjkBXFad11vE2LHhQ7')).toBe(true);
  });

  // Invalid cases
  it('rejects an empty string', () => {
    expect(isValidCid('')).toBe(false);
  });

  it('rejects a random string', () => {
    expect(isValidCid('not-a-cid')).toBe(false);
  });

  it('rejects a CIDv0 that is too short', () => {
    expect(isValidCid('QmShort')).toBe(false);
  });

  it('rejects a non-string input', () => {
    expect(isValidCid(null as unknown as string)).toBe(false);
  });

  it('rejects a plain URL', () => {
    expect(isValidCid('https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(false);
  });
});

describe('CID_REGEX', () => {
  it('matches a valid CIDv0', () => {
    expect(CID_REGEX.test('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG')).toBe(true);
  });

  it('matches a valid CIDv1', () => {
    expect(CID_REGEX.test('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toBe(true);
  });

  it('does not match an empty string', () => {
    expect(CID_REGEX.test('')).toBe(false);
  });
});
