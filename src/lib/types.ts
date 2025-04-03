// Supported wallet types
export enum WalletType {
  LEATHER = 'LEATHER',
  MAGIC_EDEN = 'MAGIC_EDEN',
  PHANTOM = 'PHANTOM',
  UNISAT = 'UNISAT',
  WIZZ = 'WIZZ',
  XVERSE = 'XVERSE'
}

// Structure for wallet connection state
export interface WalletConnectionState {
  connected: boolean;
  address: string;
  publicKey: string;
  type: WalletType | null;
}

// Structure for a UTXO (Unspent Transaction Output)
export interface UTXO {
  txid: string;
  vout: number;
  value: number; // in satoshis
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

// Structure for fee rate data
export interface FeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

// Structure for the multisig recovery form
export interface FormData {
  publicKey: string;
  multisigAddress: string;
  feeRate: number;
}

// Structure for transaction response
export interface TxResponse {
  txid: string;
  success: boolean;
}

// Structure for error response
export interface ErrorResponse {
  message: string;
  details?: string;
}
