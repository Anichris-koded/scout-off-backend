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
 */
export function verifyAndIssueToken(xdr: string, role?: string): { token: string; account: string } {
  const network =
    config.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const tx = new Transaction(xdr, network);

  // The first operation's source is the client account
  const clientAccountId = tx.operations[0].source;
  if (!clientAccountId) throw new Error('Missing source account in challenge');

  // Verify the client signed it
  const clientKeypair = Keypair.fromPublicKey(clientAccountId);
  const valid = tx.signatures.some((sig) => {
    try {
      return clientKeypair.verify(tx.hash(), sig.signature());
    } catch {
      return false;
    }
  });

  if (!valid) throw new Error('Invalid challenge signature');

  const token = jwt.sign({ sub: clientAccountId, role: role ?? 'player' }, config.jwtSecret, {
    expiresIn: TOKEN_TTL_SECONDS,
  });

  return { token, account: clientAccountId };
}
