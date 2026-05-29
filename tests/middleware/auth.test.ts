import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../../src/middleware/auth';

const SECRET = 'test-secret';
process.env.JWT_SECRET = SECRET;
process.env.CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

function makeReqRes(token?: string) {
  const req = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

function sign(payload: object, expiresIn: string | number = '1h') {
  return jwt.sign(payload, SECRET, { expiresIn } as jwt.SignOptions);
}

describe('requireAuth', () => {
  it('calls next() for a valid JWT', () => {
    const token = sign({ sub: 'GTEST', role: 'player' });
    const { req, res, next } = makeReqRes(token);
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).account).toBe('GTEST');
  });

  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = makeReqRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', () => {
    const { req, res, next } = makeReqRes('not.a.valid.token');
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const token = sign({ sub: 'GTEST' }, -1); // already expired
    const { req, res, next } = makeReqRes(token);
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('calls next() when role matches', () => {
    const token = sign({ sub: 'GTEST', role: 'validator' });
    const { req, res, next } = makeReqRes(token);
    requireRole('validator')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when role does not match', () => {
    const token = sign({ sub: 'GTEST', role: 'player' });
    const { req, res, next } = makeReqRes(token);
    requireRole('validator')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = makeReqRes();
    requireRole('validator')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const token = sign({ sub: 'GTEST', role: 'validator' }, -1);
    const { req, res, next } = makeReqRes(token);
    requireRole('validator')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
