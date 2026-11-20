import { UTXO, FeeRates } from './types';
import { bitcoin } from './bitcoinConfig';

// API endpoint for mempool.space
const MEMPOOL_API_URL = 'https://mempool.space/api';

/**
 * Fetches UTXOs for a given Bitcoin address
 * @param address - Bitcoin address to query
 * @returns Array of UTXOs
 */
export async function fetchUTXOs(address: string): Promise<UTXO[]> {
  try {
    const response = await fetch(`${MEMPOOL_API_URL}/address/${address}/utxo`);
    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
    }
    return await response.json() as UTXO[];
  } catch (error) {
    console.error('Error fetching UTXOs:', error);
    throw error;
  }
}

/**
 * Fetches current fee recommendations
 * @returns Fee rate recommendations in sat/vB
 */
export async function fetchFeeRates(): Promise<FeeRates> {
  try {
    const response = await fetch(`${MEMPOOL_API_URL}/v1/fees/recommended`);
    if (!response.ok) {
      throw new Error(`Failed to fetch fee rates: ${response.statusText}`);
    }
    return await response.json() as FeeRates;
  } catch (error) {
    console.error('Error fetching fee rates:', error);
    throw error;
  }
}

/**
 * Broadcasts a raw transaction to the Bitcoin network
 * @param txHex - Raw transaction in hex format
 * @returns The transaction ID, after checking the service echoed it back
 */
export async function broadcastTransaction(txHex: string): Promise<string> {
  // Work out the txid ourselves, so a wrong or garbled reply from the
  // broadcast service can't be shown as a successful recovery
  const txid = bitcoin.Transaction.fromHex(txHex).getId();
  try {
    const response = await fetch(`${MEMPOOL_API_URL}/tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: txHex,
    });

    // mempool.space answers with plain text: the txid, or the node's error
    const body = (await response.text()).trim();

    if (!response.ok) {
      throw new Error(body || `Failed to broadcast transaction: ${response.statusText}`);
    }

    if (body !== txid) {
      throw new Error(
        `The broadcast service gave an unexpected reply, so the transaction may not have been sent. ` +
          `Check https://mempool.space/tx/${txid} before trying again.`,
      );
    }

    return txid;
  } catch (error) {
    console.error('Error broadcasting transaction:', error);
    throw error;
  }
}
