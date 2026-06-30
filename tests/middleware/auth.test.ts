import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../../src/middleware/auth';

const SECRET = 'test-secret';
const PREV_SECRET = 'old-test-secret';
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

function sign(payload: object, secret = SECRET, expiresIn: string | number = '1h') {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

describe('requireAuth', () => {
  it('calls next() for a valid JWT', () => {
    const token = sign({ sub: 'GTEST', role: 'player' });
    const { req, res, next } = makeReqRes(token);
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.account).toBe('GTEST');
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
    const token = sign({ sub: 'GTEST' }, SECRET, -1); // already expired
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
    const token = sign({ sub: 'GTEST', role: 'validator' }, SECRET, -1);
    const { req, res, next } = makeReqRes(token);
    requireRole('validator')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a token with a manually set past exp claim', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 7200;
    const token = jwt.sign({ sub: 'GTEST', role: 'validator', exp: pastExp }, SECRET);
    const { req, res, next } = makeReqRes(token);
    requireRole('validator')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('JWT key rotation (#273)', () => {
  afterEach(() => {
    delete process.env.JWT_SECRET_PREVIOUS;
    // Reset the config module so jwtSecretPrevious is re-read
    jest.resetModules();
  });

  it('accepts a token signed with the current JWT_SECRET', () => {
    const token = sign({ sub: 'GTEST', role: 'player' }, SECRET);
    const { req, res, next } = makeReqRes(token);
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts a token signed with JWT_SECRET_PREVIOUS during rotation window', () => {
    process.env.JWT_SECRET_PREVIOUS = PREV_SECRET;
    // Re-import to pick up the new env value
    jest.resetModules();
    const { requireAuth: requireAuthFresh } = require('../../src/middleware/auth');
    const token = jwt.sign({ sub: 'GTEST', role: 'player' }, PREV_SECRET, { expiresIn: '1h' });
    const { req, res, next } = makeReqRes(token);
    requireAuthFresh(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 for a token signed with an unknown secret', () => {
    process.env.JWT_SECRET_PREVIOUS = PREV_SECRET;
    jest.resetModules();
    const { requireAuth: requireAuthFresh } = require('../../src/middleware/auth');
    const token = jwt.sign({ sub: 'GTEST', role: 'player' }, 'completely-unknown-secret', { expiresIn: '1h' });
    const { req, res, next } = makeReqRes(token);
    requireAuthFresh(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
