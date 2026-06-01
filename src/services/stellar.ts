/**
 * Stellar helper abstraction (mock)
 *
 * Placeholder implementations for signature verification, transaction building,
 * and payment submission. Designed so controllers can import and use these
 * helpers and later swap in real Stellar Horizon / SDK logic.
 */

/**
 * Verify a message signature against a public key.
 * @returns true when signature matches a mock pattern
 */
export function verifySignature(message: string, signature: string, publicKey: string): boolean{
  // Simple deterministic mock used by tests.
  return signature === `SIG_${publicKey}_${message}` || signature === 'MOCK_VALID_SIGNATURE';
}

/**
 * Build a payment transaction XDR for submission.
 * Returns a mock XDR string for tests and development.
 */
export async function buildTransaction(from: string, to: string, amount: string, memo?: string): Promise<string>{
  // Mock XDR payload
  return `MOCK_XDR from=${from} to=${to} amt=${amount} memo=${memo||''}`;
}

/**
 * Submit a payment XDR to the network (mock).
 * Returns a success object with a fake transaction hash.
 */
export async function submitPayment(xdr: string): Promise<{ success: boolean; txHash?: string; error?: string }>{
  if (!xdr) return { success: false, error: 'empty xdr' };
  // deterministic mock hash
  const txHash = `MOCK_TX_${Math.abs(xdr.length * 31).toString(16)}`;
  return { success: true, txHash };
}

export default { verifySignature, buildTransaction, submitPayment };
import { SorobanRpc, TransactionBuilder, Networks, BASE_FEE } from '@stellar/stellar-sdk';
import config from '../config';

const server = new SorobanRpc.Server(config.sorobanRpcUrl);

export { server };

export function networkPassphrase(): string {
  return config.network === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

/**
 * Fetch the latest ledger sequence — used to set transaction time bounds.
 */
export async function getLatestLedger(): Promise<number> {
  const ledger = await server.getLatestLedger();
  return ledger.sequence;
}

export type PaymentStatus = 'pending' | 'submitted' | 'failed';

export interface ContactPaymentResult {
  transactionId: string;
  status: PaymentStatus;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: 'INSUFFICIENT_FUNDS' | 'INVALID_ACCOUNT' | 'NETWORK_ERROR' | 'UNKNOWN',
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/**
 * Ping the Soroban RPC to verify network reachability.
 * Returns true if the network responds, false otherwise.
 */
export async function stellarHealth(): Promise<boolean> {
  try {
    await server.getLatestLedger();
    return true;
  } catch {
    return false;
  }
}

/**
 * Stub: submit a pay-to-contact micro-fee on Stellar.
 * Replace the body with real Soroban invocation when ready.
 */
export async function submitContactPayment(
  scoutWallet: string,
  playerId: string,
): Promise<ContactPaymentResult> {
  if (!scoutWallet || !playerId) {
    throw new PaymentError('Missing scoutWallet or playerId', 'INVALID_ACCOUNT');
  }
  // TODO: build and submit pay_to_contact Soroban transaction
  return {
    transactionId: `stub-txid-${Date.now()}`,
    status: 'submitted',
  };
}
