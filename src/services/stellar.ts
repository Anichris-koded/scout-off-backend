import { SorobanRpc, TransactionBuilder, Networks, BASE_FEE } from '@stellar/stellar-sdk';
import config from '../config';

const server = new SorobanRpc.Server(config.sorobanRpcUrl);

export { server };

export function networkPassphrase(): string {
  return config.network === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;
}

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
 * Stub: check whether a scout has an active on-chain subscription.
 * Replace with a real Soroban `is_subscribed` contract call when ready.
 */
export async function isSubscribed(
  scoutWallet: string,
): Promise<{ active: boolean; expiresAt: string | null }> {
  if (!scoutWallet) {
    throw new PaymentError('Missing scoutWallet', 'INVALID_ACCOUNT');
  }
  // TODO: invoke is_subscribed on the Soroban contract
  return { active: false, expiresAt: null };
}

/**
 * Stub: submit a pay-to-contact micro-fee on Stellar.
 * Replace with real Soroban invocation when ready.
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
