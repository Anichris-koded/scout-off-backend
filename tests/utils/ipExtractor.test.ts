import { extractClientIp } from '../../src/utils/ipExtractor';
import { Request } from 'express';

function makeReq(headers: Record<string, string>, remoteAddress = '10.0.0.1'): Request {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as Request;
}

describe('extractClientIp', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, TRUSTED_PROXY_COUNT: '1' };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('returns remoteAddress when no x-forwarded-for header', () => {
    const req = makeReq({}, '1.2.3.4');
    expect(extractClientIp(req)).toBe('1.2.3.4');
  });

  it('extracts client IP from x-forwarded-for with one trusted proxy', () => {
    // "client, proxy1" — proxy1 is trusted, so client is the real IP
    const req = makeReq({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(extractClientIp(req)).toBe('203.0.113.5');
  });

  it('handles single IP in x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '203.0.113.5' });
    expect(extractClientIp(req)).toBe('203.0.113.5');
  });

  it('returns unknown when no address available', () => {
    const req = {
      headers: {},
      socket: { remoteAddress: undefined },
    } as unknown as Request;
    expect(extractClientIp(req)).toBe('unknown');
  });
});
