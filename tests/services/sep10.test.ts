import { buildChallenge, verifyAndIssueToken } from '../../src/services/sep10';
import crypto from 'crypto';
import { Keypair, Transaction, Networks, TransactionBuilder, BASE_FEE, Operation, Account, Asset } from '@stellar/stellar-sdk';

const clientKeypair = Keypair.random();

describe('sep10', () => {
  it('buildChallenge returns a valid XDR string', () => {
    const xdr = buildChallenge(clientKeypair.publicKey());
    expect(typeof xdr).toBe('string');
    expect(xdr.length).toBeGreaterThan(0);
  });

  it('verifyAndIssueToken issues a JWT after client signs the challenge', () => {
    const xdr = buildChallenge(clientKeypair.publicKey());
    const tx = new Transaction(xdr, Networks.TESTNET);
    tx.sign(clientKeypair);
    const signedXdr = tx.toXDR();

    const { token, account } = verifyAndIssueToken(signedXdr);
    expect(typeof token).toBe('string');
    expect(account).toBe(clientKeypair.publicKey());
  });

  it('verifyAndIssueToken throws on unsigned challenge', () => {
    const xdr = buildChallenge(clientKeypair.publicKey());
    expect(() => verifyAndIssueToken(xdr)).toThrow('Invalid challenge signature');
  });

  it('verifyAndIssueToken throws when server signature is absent', () => {
    // Build a valid-looking challenge from a rogue server (not our SERVER_KEYPAIR)
    const rogueKeypair = Keypair.random();
    const rogueAccount = new Account(rogueKeypair.publicKey(), '-1');
    const tx = new TransactionBuilder(rogueAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.manageData({
          name: 'scoutoff auth',
          value: crypto.randomBytes(48).toString('base64'),
          source: clientKeypair.publicKey(),
        })
      )
      .setTimeout(300)
      .build();

    // Sign with the rogue keypair (not our server) and the client
    tx.sign(rogueKeypair);
    tx.sign(clientKeypair);
    const xdr = tx.toXDR();

    // Should reject because our server did not sign this challenge
    expect(() => verifyAndIssueToken(xdr)).toThrow('Challenge not signed by server');
  });

  // Challenge structure validation tests
  describe('challenge structure validation', () => {
    it('throws when challenge has no operations', () => {
      const serverKeypair = Keypair.random();
      const serverAccount = new Account(serverKeypair.publicKey(), '-1');
      const tx = new TransactionBuilder(serverAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .setTimeout(300)
        .build();

      tx.sign(serverKeypair);
      tx.sign(clientKeypair);
      const xdr = tx.toXDR();

      expect(() => verifyAndIssueToken(xdr)).toThrow('Invalid challenge: no operations found');
    });

    it('throws when first operation is not manageData', () => {
      const serverKeypair = Keypair.random();
      const serverAccount = new Account(serverKeypair.publicKey(), '-1');
      const tx = new TransactionBuilder(serverAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: serverKeypair.publicKey(),
            amount: '1',
            asset: new Asset('TESTCOIN', serverKeypair.publicKey()),
            source: clientKeypair.publicKey(),
          })
        )
        .setTimeout(300)
        .build();

      tx.sign(serverKeypair);
      tx.sign(clientKeypair);
      const xdr = tx.toXDR();

      expect(() => verifyAndIssueToken(xdr)).toThrow('Invalid challenge: expected manageData operation');
    });

    it('throws when operation name does not match "scoutoff auth"', () => {
      const serverKeypair = Keypair.random();
      const serverAccount = new Account(serverKeypair.publicKey(), '-1');
      const tx = new TransactionBuilder(serverAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.manageData({
            name: 'wrong name',
            value: Buffer.from(Keypair.random().rawPublicKey()).toString('base64'),
            source: clientKeypair.publicKey(),
          })
        )
        .setTimeout(300)
        .build();

      tx.sign(serverKeypair);
      tx.sign(clientKeypair);
      const xdr = tx.toXDR();

      expect(() => verifyAndIssueToken(xdr)).toThrow('Invalid challenge: wrong operation name');
    });

    it('throws when nonce value is missing', () => {
      const serverKeypair = Keypair.random();
      const serverAccount = new Account(serverKeypair.publicKey(), '-1');
      const tx = new TransactionBuilder(serverAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.manageData({
            name: 'scoutoff auth',
            value: null, // Explicitly no nonce
            source: clientKeypair.publicKey(),
          })
        )
        .setTimeout(300)
        .build();

      tx.sign(serverKeypair);
      tx.sign(clientKeypair);
      const xdr = tx.toXDR();

      expect(() => verifyAndIssueToken(xdr)).toThrow('Invalid challenge: missing nonce value');
    });

    it('throws when nonce is not exactly 64 bytes (decoded)', () => {
      const serverKeypair = Keypair.random();
      const serverAccount = new Account(serverKeypair.publicKey(), '-1');
      const tx = new TransactionBuilder(serverAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.manageData({
            name: 'scoutoff auth',
            value: Buffer.from('too-short'), // 9 bytes instead of 64
            source: clientKeypair.publicKey(),
          })
        )
        .setTimeout(300)
        .build();

      tx.sign(serverKeypair);
      tx.sign(clientKeypair);
      const xdr = tx.toXDR();

      expect(() => verifyAndIssueToken(xdr)).toThrow('Invalid challenge: nonce must be exactly 64 bytes');
    });

    it('throws when operation source is missing', () => {
      const serverKeypair = Keypair.random();
      const serverAccount = new Account(serverKeypair.publicKey(), '-1');
      const tx = new TransactionBuilder(serverAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.manageData({
            name: 'scoutoff auth',
            value: crypto.randomBytes(48).toString('base64'),
            // No source specified - defaults to undefined
          })
        )
        .setTimeout(300)
        .build();

      tx.sign(serverKeypair);
      tx.sign(clientKeypair);
      const xdr = tx.toXDR();

      expect(() => verifyAndIssueToken(xdr)).toThrow('Missing source account in challenge');
    });

    it('accepts valid challenge with correct structure', () => {
      const xdr = buildChallenge(clientKeypair.publicKey());
      const tx = new Transaction(xdr, Networks.TESTNET);
      tx.sign(clientKeypair);
      const signedXdr = tx.toXDR();

      const { token, account } = verifyAndIssueToken(signedXdr);
      expect(typeof token).toBe('string');
      expect(account).toBe(clientKeypair.publicKey());
    });
  });

  describe('TTL / expiry enforcement', () => {
    it('throws when challenge maxTime has passed', () => {
      const xdr = buildChallenge(clientKeypair.publicKey());
      const tx = new Transaction(xdr, Networks.TESTNET);
      tx.sign(clientKeypair);
      const signedXdr = tx.toXDR();

      // Advance Date.now() past the challenge TTL (300 s)
      const realNow = Date.now;
      Date.now = () => realNow() + 400_000; // +400 seconds → past maxTime
      try {
        expect(() => verifyAndIssueToken(signedXdr)).toThrow('Challenge has expired');
      } finally {
        Date.now = realNow;
      }
    });

    it('accepts a challenge whose maxTime has not yet passed', () => {
      const xdr = buildChallenge(clientKeypair.publicKey());
      const tx = new Transaction(xdr, Networks.TESTNET);
      tx.sign(clientKeypair);
      const signedXdr = tx.toXDR();

      // Wind back time slightly to ensure we're before maxTime
      const realNow = Date.now;
      Date.now = () => realNow() - 1_000;
      try {
        const { token } = verifyAndIssueToken(signedXdr);
        expect(typeof token).toBe('string');
      } finally {
        Date.now = realNow;
      }
    });
  });
});
