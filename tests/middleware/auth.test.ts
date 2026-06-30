import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import * as auditService from '../../src/services/audit';

const SECRET = 'test-secret';
process.env.JWT_SECRET = SECRET;
process.env.CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

function makeReqRes(token?: string, path = '/test') {
  const req = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    path,
    socket: { remoteAddress: '127.0.0.1' },
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

  it('creates an audit event with action:auth_failed on missing token', () => {
    const spy = jest.spyOn(auditService, 'logAuditEvent');
    const { req, res, next } = makeReqRes(undefined, '/api/scouts/wallet/subscription');
    requireAuth(req, res, next);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_failed',
        path: '/api/scouts/wallet/subscription',
        reason: 'Missing auth token',
      })
    );
    spy.mockRestore();
  });

  it('creates an audit event with action:auth_failed on invalid token', () => {
    const spy = jest.spyOn(auditService, 'logAuditEvent');
    const { req, res, next } = makeReqRes('bad.token.here');
    requireAuth(req, res, next);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth_failed', reason: 'Invalid or expired token' })
    );
    spy.mockRestore();
  });

  it('does not include raw JWT in the audit event', () => {
    const spy = jest.spyOn(auditService, 'logAuditEvent');
    const { req, res, next } = makeReqRes('bad.token.here');
    requireAuth(req, res, next);
    const call = spy.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain('bad.token.here');
    spy.mockRestore();
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

  it('creates an audit event with action:auth_forbidden on role mismatch', () => {
    const spy = jest.spyOn(auditService, 'logAuditEvent');
    const token = sign({ sub: 'GWALLET', role: 'player' });
    const { req, res, next } = makeReqRes(token, '/api/admin/stats');
    requireRole('admin')(req, res, next);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_forbidden',
        path: '/api/admin/stats',
        requiredRole: 'admin',
        reason: 'Insufficient permissions',
      })
    );
    spy.mockRestore();
  });

  it('creates an audit event with action:auth_failed on missing token for requireRole', () => {
    const spy = jest.spyOn(auditService, 'logAuditEvent');
    const { req, res, next } = makeReqRes(undefined, '/api/admin/stats');
    requireRole('admin')(req, res, next);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth_failed',
        requiredRole: 'admin',
        reason: 'Missing auth token',
      })
    );
    spy.mockRestore();
  });
});
