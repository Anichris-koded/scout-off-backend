import { Request, Response, NextFunction } from 'express';
import { responseTime } from '../../src/middleware/responseTime';

function makeReqRes() {
  const listeners: Record<string, (() => void)[]> = {};
  const headers: Record<string, string> = {};

  const req = {} as Request;
  const res = {
    on: (event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    },
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    emit: (event: string) => {
      (listeners[event] ?? []).forEach((cb) => cb());
    },
    _headers: headers,
  } as unknown as Response & { emit: (e: string) => void; _headers: Record<string, string> };
  const next = jest.fn() as NextFunction;
  return { req, res, next, headers };
}

describe('responseTime middleware', () => {
  it('calls next()', () => {
    const { req, res, next } = makeReqRes();
    responseTime(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets X-Response-Time header on finish with "ms" suffix', () => {
    const { req, res, next, headers } = makeReqRes();
    responseTime(req, res, next);
    res.emit('finish');
    expect(headers['x-response-time']).toMatch(/^\d+ms$/);
  });

  it('X-Response-Time value is a non-negative integer', () => {
    const { req, res, next, headers } = makeReqRes();
    responseTime(req, res, next);
    res.emit('finish');
    const ms = parseInt(headers['x-response-time'], 10);
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('does not set header before finish fires', () => {
    const { req, res, next, headers } = makeReqRes();
    responseTime(req, res, next);
    expect(headers['x-response-time']).toBeUndefined();
  });
});
