import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Account,
  Transaction,
} from '@stellar/stellar-sdk';
import jwt from 'jsonwebtoken';
import config from '../config';

const SERVER_KEYPAIR = Keypair.random(); // ephemeral; use a persisted key in production
const CHALLENGE_TTL_SECONDS = 300; // 5 min to sign the challenge
const TOKEN_TTL_SECONDS = 86400;   // 24 h JWT validity

/**
 * Build a SEP-10 challenge transaction.
 * The client must sign it with their Stellar keypair and return the XDR.
 */
export function buildChallenge(accountId: string): string {
  const serverAccount = new Account(SERVER_KEYPAIR.publicKey(), '-1');
  const tx = new TransactionBuilder(serverAccount, {
    fee: BASE_FEE,
    networkPassphrase:
      config.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
  })
    .addOperation(
      Operation.manageData({
        name: 'scoutoff auth',
        value: Buffer.from(Keypair.random().rawPublicKey()).toString('base64'),
        source: accountId,
      })
    )
    .setTimeout(CHALLENGE_TTL_SECONDS)
    .build();

  tx.sign(SERVER_KEYPAIR);
  return tx.toXDR();
}

/**
 * Extract the client account from a challenge XDR without verifying signatures.
 * Used to determine the effective role before issuing a token.
 */
export function extractAccount(xdr: string): string | null {
  try {
    const network =
      config.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const tx = new Transaction(xdr, network);
    return tx.operations[0].source ?? null;
  } catch {
    return null;
  }
}

/**
 * Verify the client-signed challenge XDR and issue a JWT.
 *
 * This implements SEP-10 authentication by:
 * 1. Validating the challenge transaction structure
 * 2. Cryptographically verifying the client's signature using Keypair.verify()
 * 3. Issuing a JWT if all checks pass
 *
 * @param xdr - The signed challenge transaction in XDR format
 * @param role - Optional role claim for the JWT (defaults to 'player')
 * @returns JWT token and authenticated account ID
 * @throws Error if challenge structure is invalid or signature verification fails
 */
export function verifyAndIssueToken(xdr: string, role?: string): { token: string; account: string } {
  const network =
    config.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const tx = new Transaction(xdr, network);

  // Validate challenge transaction structure
  if (!tx.operations || tx.operations.length === 0) {
    throw new Error('Invalid challenge: no operations found');
  }

  const op = tx.operations[0];

  // 1. Verify the first operation is manageData
  if (op.type !== 'manageData') {
    throw new Error('Invalid challenge: expected manageData operation');
  }

  // 2. Verify the operation name matches the expected server string
  const manageDataOp = op as Operation.ManageData;
  if (manageDataOp.name !== 'scoutoff auth') {
    throw new Error('Invalid challenge: wrong operation name');
  }

  // 3. Verify the nonce value is present and properly formatted (64 bytes)
  if (!manageDataOp.value) {
    throw new Error('Invalid challenge: missing nonce value');
  }

  // Validate the nonce is exactly 64 bytes by checking the raw buffer length
  if (manageDataOp.value.length !== 64) {
    throw new Error('Invalid challenge: nonce must be exactly 64 bytes');
  }

  // 4. Verify the operation's source is the client account
  const clientAccountId = manageDataOp.source;
  if (!clientAccountId) {
    throw new Error('Missing source account in challenge');
  }

  // 5. Cryptographically verify the client signed the transaction
  // Using Keypair.verify() for proper ECDSA signature validation per SEP-10
  const clientKeypair = Keypair.fromPublicKey(clientAccountId);
  const valid = tx.signatures.some((sig) => {
    try {
      return clientKeypair.verify(tx.hash(), sig.signature());
    } catch {
      return false;
    }
  });

  if (!valid) throw new Error('Invalid challenge signature');

  // Issue JWT with client account and role
  const token = jwt.sign({ sub: clientAccountId, role: role ?? 'player' }, config.jwtSecret, {
    expiresIn: TOKEN_TTL_SECONDS,
  });

  return { token, account: clientAccountId };
}
