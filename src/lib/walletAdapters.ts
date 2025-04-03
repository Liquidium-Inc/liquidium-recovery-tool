import {
  SignTransactionOptions,
  BitcoinNetworkType,
  AddressPurpose,
  request,
  getAddress,
  signTransaction,
  GetAddressResponse,
  BitcoinProvider,
  InputToSign,
} from "sats-connect";
import { getWallets } from "@wallet-standard/core";
import { WalletType } from "./types";
import { bitcoin } from "./bitcoinConfig";
import { Buffer } from "buffer";

declare global {
  interface Window {
    phantom?: {
      bitcoin?: {
        isPhantom: boolean;
      } & PhantomProvider;
    };
  }
}

export interface ConnectResponse {
  address: string;
  publicKey: string;
}

// Base interface for wallet adapters
export interface WalletAdapter {
  connect: () => Promise<ConnectResponse>; // Returns a Bitcoin address
  signPSBT: (
    psbtHex: string,
    inputsToSign: number[],
  ) => Promise<string>; // Returns signed PSBT hex
  disconnect: () => Promise<void>;
}

// Base class with standard disconnect
abstract class BaseWalletAdapter implements WalletAdapter {
  protected address: string = "";
  protected publicKey: string = "";

  abstract connect(): Promise<ConnectResponse>;
  abstract signPSBT(psbtHex: string, inputsToSign: number[]): Promise<string>;
  
  async disconnect(): Promise<void> {
    this.address = "";
    this.publicKey = "";
    return Promise.resolve();
  }
}

// Factory function to create a wallet adapter based on the wallet type
export function createWalletAdapter(walletType: WalletType): BaseWalletAdapter {
  switch (walletType) {
    case WalletType.XVERSE:
      return new XverseAdapter();
    case WalletType.UNISAT:
      return new UnisatAdapter();
    case WalletType.LEATHER:
      return new LeatherAdapter();
    case WalletType.MAGIC_EDEN:
      return new MagicEdenAdapter();
    case WalletType.PHANTOM:
      return new PhantomAdapter();
    // TODO: Wizz is not tested
    case WalletType.WIZZ:
      return new WizzAdapter();
    default:
      throw new Error(`Unsupported wallet type: ${walletType}`);
  }
}

// Implementation for Xverse wallet using sats-connect
class XverseAdapter extends BaseWalletAdapter {
  protected address: string = "";
  protected publicKey: string = "";

  async connect(): Promise<ConnectResponse> {
    try {
      const response = await request("getAccounts", {
        purposes: [AddressPurpose.Payment],
        message: "Welcome to Liquidium!",
      });

      if (response.status === "error") {
        if (response.error.code == -32000) {
          throw new Error("Cancelled the sign request");
        }
        throw new Error(response.error.message);
      }

      let info = response.result.find(
        (i) => i.purpose === AddressPurpose.Payment
      );

      this.address = info?.address || "";
      this.publicKey = info?.publicKey || "";

      return { address: this.address, publicKey: this.publicKey };
    } catch (error) {
      console.error("Error connecting to Xverse wallet:", error);
      throw error;
    }
  }

  async signPSBT(
    psbtHex: string,
    inputsToSign: number[],
  ): Promise<string> {
    try {
      if (!this.address) {
        throw new Error("Wallet not connected");
      }

      return new Promise((resolve, reject) => {
        // Format the inputs for Xverse
        const formattedInputs = inputsToSign.map((index) => ({
          address: this.address,
          index,
          signingIndexes: [index],
        }));

        const signPsbtOptions: SignTransactionOptions = {
          payload: {
            network: {
              type: BitcoinNetworkType.Mainnet,
            },
            message: "Sign transaction to sweep multisig funds",
            psbtBase64: Buffer.from(psbtHex, "hex").toString("base64"),
            broadcast: false,
            inputsToSign: formattedInputs,
          },
          onFinish: (response: any) => {
            resolve(Buffer.from(response.psbtBase64, "base64").toString("hex"));
          },
          onCancel: () => {
            reject(new Error("User cancelled signing request"));
          },
        };

        signTransaction(signPsbtOptions);
      });
    } catch (error) {
      console.error("Error signing PSBT with Xverse wallet:", error);
      throw error;
    }
  }
}

// Implementation for Unisat wallet
class UnisatAdapter extends BaseWalletAdapter {
  protected address: string = "";
  protected publicKey: string = "";

  async connect(): Promise<ConnectResponse> {
    try {
      // Access the Unisat provider from the window object
      const unisat = (window as any).unisat;

      if (!unisat) {
        throw new Error("Unisat wallet not found");
      }

      const accounts = await unisat.requestAccounts();
      this.address = accounts[0];
      this.publicKey = await unisat.getPublicKey();

      return { address: this.address, publicKey: this.publicKey };
    } catch (error) {
      console.error("Error connecting to Unisat wallet:", error);
      throw error;
    }
  }

  async signPSBT(
    psbtHex: string,
    inputsToSign: number[],
  ): Promise<string> {
    try {
      if (!this.address) {
        throw new Error("Wallet not connected");
      }

      const unisat = (window as any).unisat;

      if (!unisat) {
        throw new Error("Unisat wallet not found");
      }

      // Format inputs for Unisat
      const toSignInputs = inputsToSign.map((index) => ({
        index,
        address: this.address,
        sighashTypes: [1], // SIGHASH_ALL
        disableTweakSigner: true, // Disable tweak signer for multisig
      }));

      const signedPsbtHex = await unisat.signPsbt(psbtHex, {
        autoFinalized: false,
        toSignInputs,
      });

      return signedPsbtHex;
    } catch (error) {
      console.error("Error signing PSBT with Unisat wallet:", error);
      throw error;
    }
  }
}

// Implementation for Leather wallet
class LeatherAdapter extends BaseWalletAdapter {
  protected address: string = "";
  protected publicKey: string = "";

  async connect(): Promise<ConnectResponse> {
    try {
      const btc = (window as any).btc;

      if (!btc) {
        throw new Error("Leather wallet not found");
      }

      const response = await btc.request("getAddresses");
      if (!response?.result?.addresses?.length) {
        throw new Error("No addresses returned from Leather wallet");
      }

      // Get the first address
      this.address = response.result.addresses[0].address;
      this.publicKey = response.result.addresses[0].publicKey;

      return { address: this.address, publicKey: this.publicKey };
    } catch (error) {
      console.error("Error connecting to Leather wallet:", error);
      throw error;
    }
  }

  async signPSBT(
    psbtHex: string,
    inputsToSign: number[],
  ): Promise<string> {
    try {
      if (!this.address) {
        throw new Error("Wallet not connected");
      }

      const btc = (window as any).btc;

      if (!btc) {
        throw new Error("Leather wallet not found");
      }

      const signPsbtOptions = {
        hex: psbtHex,
        broadcast: false,
        signAtIndex: inputsToSign,
        allowedSighash: [1], // SIGHASH_ALL
        network: "mainnet",
        // If multisig address is provided, we need to specify which account to use
        account: (await this.getAccountForAddress(this.address)) ?? undefined,
      };

      // Sign PSBT with Leather
      const response = await btc.request("signPsbt", signPsbtOptions);

      if (!response?.result?.hex) {
        throw new Error("Failed to sign PSBT with Leather wallet");
      }

      return response.result.hex;
    } catch (error) {
      console.error("Error signing PSBT with Leather wallet:", error);
      throw error;
    }
  }

  private async getAccountForAddress(
    address: string
  ): Promise<number | undefined> {
    try {
      const response = await (window as any).btc.request("getAddresses");
      if (!response?.result?.addresses) return undefined;

      const addressInfo = response.result.addresses.find(
        (addr: any) => addr.address === address
      );

      if (!addressInfo?.derivationPath) return undefined;

      // Extract account index from derivation path (m/84'/0'/X'/0/0)
      const match = addressInfo.derivationPath.match(/m\/\d+'\/\d+'\/(\d+)'/);
      return match ? parseInt(match[1]) : undefined;
    } catch (error) {
      console.error("Error getting account for address:", error);
      return undefined;
    }
  }
}

// Implementation for Magic Eden wallet
class MagicEdenAdapter extends BaseWalletAdapter {
  protected address: string = "";
  protected publicKey: string = "";
  private provider: BitcoinProvider | undefined = undefined;

  private getProvider() {
    if (this.provider) {
      return this.provider;
    }

    const magicEden = getWallets()
      .get()
      .find((wallet) => wallet.name === "Magic Eden");

    if (!magicEden) {
      return undefined;
    }

    if (!("sats-connect:" in magicEden.features)) {
      return undefined;
    }

    const provider = (magicEden.features["sats-connect:"] as any)
      .provider as BitcoinProvider;

    this.provider = provider;

    return provider;
  }

  async connect(): Promise<ConnectResponse> {
    try {
      const provider = this.getProvider();
      if (!provider) {
        throw new Error("could not get provider");
      }

      return new Promise((resolve, reject) => {
        return getAddress({
          payload: {
            purposes: [AddressPurpose.Payment],
            message: "Address for receiving payments",
            network: {
              type: BitcoinNetworkType.Mainnet,
            },
          },
          getProvider: async () => provider,
          onFinish: async (response: GetAddressResponse) => {
            let payment = response.addresses.find(
              (i) => i.purpose === AddressPurpose.Payment
            );

            if (!payment) {
              reject(
                new Error(
                  "Missing addresses from MagicEden get address request"
                )
              );
              return;
            }

            this.address = payment.address;
            this.publicKey = payment.publicKey;

            resolve({ address: payment.address, publicKey: payment.publicKey });
          },
          onCancel: () => {
            reject(new Error("User cancelled the address request"));
          },
        });
      });
    } catch (error) {
      console.error("Error connecting to Magic Eden wallet:", error);
      throw error;
    }
  }

  async signPSBT(
    psbtHex: string,
    inputsToSign: number[],
  ): Promise<string> {
    try {
      const provider = this.getProvider();
      if (!provider) {
        throw new Error("could not get provider");
      }

      const inputsToSignME = [{
        address: this.address,
        signingIndexes: inputsToSign,
        sigHash: 1,
      }] as InputToSign[]

      return new Promise((resolve, reject) => {
        signTransaction({
          payload: {
            network: {
              type: BitcoinNetworkType.Mainnet,
            },
            message: "Sign transaction to sweep multisig funds",
            psbtBase64: psbtHex,
            broadcast: false,
            inputsToSign: inputsToSignME,
          },
          getProvider: async () => provider,
          onFinish: (response) => {
            resolve(response.psbtBase64);
          },
          onCancel: () => {
            reject(new Error("Cancelled the sign transaction request"));
          },
        }).catch((error) => {
          console.error("Failed to sign PSBT with MagicEden wallet:", error);
          reject(new Error("Failed to sign PSBT with MagicEden wallet"));
        });
      });
    } catch (error) {
      console.error("Error signing PSBT with Magic Eden wallet:", error);
      throw error;
    }
  }
}

// Phantom provider type
interface PhantomProvider {
  requestAccounts: () => Promise<
    | {
        address: string;
        addressType: "p2tr" | "p2wpkh" | "p2sh" | "p2pkh";
        publicKey: string;
        purpose: "payment" | "ordinals";
      }[]
    | undefined // still possibly undefined?
  >;
  signMessage: (
    address: string,
    message: Uint8Array,
  ) => Promise<{
    signature: Uint8Array;
    signedMessage: Uint8Array;
  }>;
  signPSBT(
    psbt: Uint8Array,
    options: {
      inputsToSign: {
        sigHash?: number | undefined;
        address: string;
        signingIndexes: number[];
      }[];
    },
  ): Promise<Uint8Array>;
}

// Implementation for Phantom wallet
class PhantomAdapter extends BaseWalletAdapter {
  protected address: string = "";
  protected publicKey: string = "";

  private getProvider(): PhantomProvider | undefined {
    if (!window.phantom?.bitcoin?.isPhantom) {
      return undefined;
    }

    return window.phantom.bitcoin as PhantomProvider;
  }

  async connect(): Promise<ConnectResponse> {
    try {
      const provider = this.getProvider();
      if (!provider) {
        throw new Error("phantom not installed");
      }

      const response = await provider.requestAccounts();
      if (!response) {
        throw new Error("could not list accounts");
      }

      const payment = response.find((i) => i.purpose === AddressPurpose.Payment);
      if (!payment) {
        throw new Error("missing addresses from phantom get address request");
      }

      this.address = payment.address;
      this.publicKey = payment.publicKey;

      return { address: payment.address, publicKey: payment.publicKey };
    } catch (error) {
      console.error("Error connecting to Phantom wallet:", error);
      throw error;
    }
  }

  async signPSBT(
    psbtHex: string,
    inputsToSign: number[],
  ): Promise<string> {
    try {
      const provider = this.getProvider();
      if (!provider) {
        throw new Error("phantom not available");
      }

      const psbtIn = bitcoin.Psbt.fromHex(psbtHex);
  
      let signedBytes: Uint8Array;
      try {
        signedBytes = await provider.signPSBT(
          Uint8Array.from(psbtIn.toBuffer()),
          {
            inputsToSign: inputsToSign.map((index) => ({
              address: this.address,
              signingIndexes: [index],
              sigHash: 1,
            })) as InputToSign[],
          },
        );
      } catch (error: any) {
        if (error.code === 4001) {
          throw new Error("Cancelled the sign request");
        }
        console.error("Failed to sign PSBT with Unisat wallet:", error);
        throw error;
      }
      const psbt = bitcoin.Psbt.fromBuffer(Buffer.from(signedBytes));
      return psbt.toHex();
    } catch (error) {
      console.error("Error signing PSBT with Phantom wallet:", error);
      throw error;
    }
  }
}

// Implementation for Wizz wallet
class WizzAdapter extends BaseWalletAdapter {
  protected address: string = "";
  protected publicKey: string = "";

  async connect(): Promise<ConnectResponse> {
    try {
      const wizz = (window as any).wizz;

      if (!wizz) {
        throw new Error("Wizz wallet not found");
      }

      const accounts = await wizz.bitcoin.requestAccounts();
      if (!accounts?.[0]) {
        throw new Error("No address returned from Wizz wallet");
      }

      this.address = accounts[0];
      return { address: accounts[0], publicKey: this.publicKey };
    } catch (error) {
      console.error("Error connecting to Wizz wallet:", error);
      throw error;
    }
  }

  async signPSBT(
    psbtHex: string,
    inputsToSign: number[],
  ): Promise<string> {
    try {
      if (!this.address) {
        throw new Error("Wallet not connected");
      }

      const wizz = (window as any).wizz;

      if (!wizz) {
        throw new Error("Wizz wallet not found");
      }

      // Format inputs for Wizz
      const signOptions = {
        psbt: psbtHex,
        inputsToSign: inputsToSign.map((index) => ({
          index,
          address: this.address,
          sighashType: 1, // SIGHASH_ALL
        })),
      };

      const signedPsbtHex = await wizz.bitcoin.signPsbt(signOptions);
      return signedPsbtHex;
    } catch (error) {
      console.error("Error signing PSBT with Wizz wallet:", error);
      throw error;
    }
  }
}
