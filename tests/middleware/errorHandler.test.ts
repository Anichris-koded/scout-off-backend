import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssueCode } from 'zod';

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { errorHandler } from '../../src/middleware/errorHandler';

function makeReq(correlationId?: string): Request {
  return { correlationId } as unknown as Request;
}

function makeRes() {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

const next = jest.fn() as unknown as NextFunction;

// Helper to extract the response body sent to the client
function getBody(res: Response): Record<string, unknown> {
  return ((res.status as jest.Mock).mock.results[0].value.json as jest.Mock).mock.calls[0][0];
}

describe('errorHandler', () => {
  // ── existing coverage ──────────────────────────────────────────────────────
  it('includes correlationId in 500 error response when set on req', () => {
    const req = makeReq('test-corr-id');
    const res = makeRes();
    errorHandler(new Error('something went wrong'), req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(500);
    const body = getBody(res);
    expect(body.correlationId).toBe('test-corr-id');
    expect(body.success).toBe(false);
    expect(body.error).toBe('something went wrong');
  });

  it('omits correlationId when not present on req', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    errorHandler(new Error('oops'), req, res, next);
    const body = getBody(res);
    expect(body.correlationId).toBeUndefined();
    expect(body.success).toBe(false);
  });

  it('includes correlationId in ZodError 400 response', () => {
    const req = makeReq('zod-corr-id');
    const res = makeRes();
    const zodErr = new ZodError([
      { code: ZodIssueCode.custom, message: 'Invalid field', path: ['field'] },
    ]);
    errorHandler(zodErr, req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    const body = getBody(res);
    expect(body.correlationId).toBe('zod-corr-id');
    expect(body.success).toBe(false);
  });

  it('returns 400 for ZodError without correlationId when req has none', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    const zodErr = new ZodError([
      { code: ZodIssueCode.custom, message: 'Bad', path: [] },
    ]);
    errorHandler(zodErr, req, res, next);
    const body = getBody(res);
    expect(body.correlationId).toBeUndefined();
    expect(body.success).toBe(false);
  });

  // ── issue #46: known errors produce appropriate status codes ───────────────
  it('returns HTTP 400 for ZodError (validation error)', () => {
    const req = makeReq();
    const res = makeRes();
    const zodErr = new ZodError([
      { code: ZodIssueCode.too_small, minimum: 1, type: 'string', inclusive: true, message: 'Too short', path: ['name'] },
    ]);
    errorHandler(zodErr, req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    const body = getBody(res);
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe('string');
  });

  it('ZodError response contains the first validation message', () => {
    const req = makeReq();
    const res = makeRes();
    const zodErr = new ZodError([
      { code: ZodIssueCode.custom, message: 'wallet is required', path: ['wallet'] },
    ]);
    errorHandler(zodErr, req, res, next);
    const body = getBody(res);
    expect(body.error).toBe('wallet is required');
  });

  // ── issue #46: unexpected errors return HTTP 500 with generic message ──────
  it('returns HTTP 500 for unexpected generic errors', () => {
    const req = makeReq();
    const res = makeRes();
    errorHandler(new Error('unexpected boom'), req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(500);
    const body = getBody(res);
    expect(body.success).toBe(false);
    expect(body.error).toBe('unexpected boom');
  });

  it('returns HTTP 500 for thrown non-Zod errors', () => {
    const req = makeReq();
    const res = makeRes();
    errorHandler(new TypeError('cannot read property of null'), req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(500);
  });

  // ── issue #46: stack hidden in production ─────────────────────────────────
  it('does not include stack trace in the response body', () => {
    const req = makeReq();
    const res = makeRes();
    errorHandler(new Error('private error'), req, res, next);
    const body = getBody(res);
    // Stack must never be exposed in the API response
    expect(body.stack).toBeUndefined();
  });

  it('does not expose stack trace in production environment', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const req = makeReq();
    const res = makeRes();
    errorHandler(new Error('prod error'), req, res, next);
    const body = getBody(res);
    expect(body.stack).toBeUndefined();
    process.env.NODE_ENV = prevEnv;
  });

  // ── error response shape invariants ────────────────────────────────────────
  it('response always has success: false', () => {
    const req = makeReq();
    const res = makeRes();
    errorHandler(new Error('any'), req, res, next);
    const body = getBody(res);
    expect(body.success).toBe(false);
  });
});
