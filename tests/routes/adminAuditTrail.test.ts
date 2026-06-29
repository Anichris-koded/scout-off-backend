import request from 'supertest';
import { Keypair, Transaction, Networks } from '@stellar/stellar-sdk';
import app from '../../src/app';
import * as auditService from '../../src/services/audit';

async function getAdminToken(): Promise<string> {
  const kp = Keypair.random();
  const challengeRes = await request(app).get(`/auth/challenge?account=${kp.publicKey()}`);
  const tx = new Transaction(challengeRes.body.challenge, Networks.TESTNET);
  tx.sign(kp);
  const tokenRes = await request(app)
    .post('/auth/token')
    .send({ transaction: tx.toXDR(), role: 'admin' });
  return tokenRes.body.token;
}

describe('Admin contract audit trail (#101)', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(auditService, 'logAuditEvent');
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs audit event with contractAction=pause_contract on POST /api/admin/contract/pause', async () => {
    const token = await getAdminToken();
    await request(app)
      .post('/api/admin/contract/pause')
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract_state_change',
        contractAction: 'pause_contract',
      })
    );
  });

  it('logs audit event with contractAction=unpause_contract on POST /api/admin/contract/unpause', async () => {
    const token = await getAdminToken();
    await request(app)
      .post('/api/admin/contract/unpause')
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'contract_state_change',
        contractAction: 'unpause_contract',
      })
    );
  });

  it('audit entry includes adminWallet and timestamp', async () => {
    const token = await getAdminToken();
    await request(app)
      .post('/api/admin/contract/pause')
      .set('Authorization', `Bearer ${token}`)
      .expect(202);

    const call = logSpy.mock.calls[0][0];
    expect(typeof call.adminWallet).toBe('string');
    expect(typeof call.timestamp).toBe('string');
  });
});
