import { Request, Response, NextFunction } from 'express';
import { requireOwner, isOwner } from '../../src/middleware/requireOwner';

function makeReqRes(account: string | undefined, playerId: string) {
  const req = { params: { playerId }, account } as unknown as Request;
  (req as any).account = account;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('isOwner', () => {
  it('returns true when account matches targetId', () => {
    expect(isOwner('GPLAYER1', 'GPLAYER1')).toBe(true);
  });

  it('returns false when account does not match', () => {
    expect(isOwner('GPLAYER1', 'GPLAYER2')).toBe(false);
  });

  it('returns false when account is undefined', () => {
    expect(isOwner(undefined, 'GPLAYER1')).toBe(false);
  });
});

describe('requireOwner middleware', () => {
  it('calls next() when account matches playerId', () => {
    const { req, res, next } = makeReqRes('GPLAYER1', 'GPLAYER1');
    requireOwner(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when account does not match playerId', () => {
    const { req, res, next } = makeReqRes('GPLAYER1', 'GPLAYER2');
    requireOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when account is undefined', () => {
    const { req, res, next } = makeReqRes(undefined, 'GPLAYER1');
    requireOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
