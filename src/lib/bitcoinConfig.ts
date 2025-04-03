import * as bitcoin from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import * as tinySecp256k1 from 'tiny-secp256k1';

// Initialize the ECDSA library with tiny-secp256k1
bitcoin.initEccLib(tinySecp256k1);

// Configure the Bitcoin network (mainnet)
export const NETWORK = bitcoin.networks.bitcoin;

// Utility function to validate a Bitcoin address
export const isValidBitcoinAddress = (address: string): boolean => {
  try {
    bitcoin.address.toOutputScript(address, NETWORK);
    return true;
  } catch (error) {
    return false;
  }
};

// Utility function to validate a public key (hex format)
export const isValidPublicKey = (publicKey: string): boolean => {
  try {
    // Public key should be a hexadecimal string
    if (!/^[0-9a-fA-F]+$/.test(publicKey)) {
      return false;
    }

    // Convert hex to Buffer and check if it's a valid public key
    const pubKeyBuffer = Buffer.from(publicKey, 'hex');
    return tinySecp256k1.isPoint(pubKeyBuffer);
  } catch (error) {
    return false;
  }
};

// Export bitcoinjs-lib for use in other files
export { bitcoin }; 
