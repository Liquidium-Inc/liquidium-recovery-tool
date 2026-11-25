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

// Whether the address is one of the standard single-key addresses
// (P2WPKH, P2SH-P2WPKH, P2PKH or key-path P2TR) of this compressed public key
export const addressMatchesPublicKey = (address: string, publicKey: string): boolean => {
  try {
    const pubkey = Buffer.from(publicKey, 'hex');
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network: NETWORK });
    return [
      p2wpkh.address,
      bitcoin.payments.p2sh({ redeem: p2wpkh, network: NETWORK }).address,
      bitcoin.payments.p2pkh({ pubkey, network: NETWORK }).address,
      bitcoin.payments.p2tr({ internalPubkey: pubkey.subarray(1, 33), network: NETWORK }).address,
    ].includes(address);
  } catch (error) {
    return false;
  }
};

// Export bitcoinjs-lib for use in other files
export { bitcoin }; 
