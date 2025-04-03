import { UTXO, FeeRates, TxResponse, ErrorResponse } from './types';

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
 * @returns Transaction response with txid
 */
export async function broadcastTransaction(txHex: string): Promise<TxResponse> {
  try {
    const response = await fetch(`${MEMPOOL_API_URL}/tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: txHex,
    });

    if (!response.ok) {
      const errorData = await response.json() as ErrorResponse;
      throw new Error(errorData.message || `Failed to broadcast transaction: ${response.statusText}`);
    }

    const txid = await response.text();
    return { txid, success: true };
  } catch (error) {
    console.error('Error broadcasting transaction:', error);
    throw error;
  }
}
