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

describe('errorHandler', () => {
  it('includes correlationId in 500 error response when set on req', () => {
    const req = makeReq('test-corr-id');
    const res = makeRes();
    errorHandler(new Error('something went wrong'), req, res, next);
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(500);
    const body = ((res.status as jest.Mock).mock.results[0].value.json as jest.Mock).mock.calls[0][0];
    expect(body.correlationId).toBe('test-corr-id');
    expect(body.success).toBe(false);
    expect(body.error).toBe('something went wrong');
  });

  it('omits correlationId when not present on req', () => {
    const req = makeReq(undefined);
    const res = makeRes();
    errorHandler(new Error('oops'), req, res, next);
    const body = ((res.status as jest.Mock).mock.results[0].value.json as jest.Mock).mock.calls[0][0];
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
    const body = ((res.status as jest.Mock).mock.results[0].value.json as jest.Mock).mock.calls[0][0];
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
    const body = ((res.status as jest.Mock).mock.results[0].value.json as jest.Mock).mock.calls[0][0];
    expect(body.correlationId).toBeUndefined();
    expect(body.success).toBe(false);
  });
});
