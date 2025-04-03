import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { WalletConnectionState, WalletType } from '../lib/types';
import { createWalletAdapter, WalletAdapter } from '../lib/walletAdapters';

// Define the context type for wallet state
interface WalletContextType {
  walletState: WalletConnectionState;
  connect: (walletType: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  availableWallets: WalletType[];
  signPSBT: (psbtHex: string, inputsToSign: number[]) => Promise<string>;
}

// Create wallet context with default values
const WalletContext = createContext<WalletContextType>({
  walletState: { connected: false, address: "", publicKey: "", type: null },
  connect: async () => { throw new Error('Not implemented'); },
  disconnect: async () => { throw new Error('Not implemented'); },
  availableWallets: [],
  signPSBT: async () => { throw new Error('Not implemented'); },
});

// Custom hook to use the wallet context
export const useWallet = () => useContext(WalletContext);

// Props for the provider component
interface WalletProviderProps {
  children: ReactNode;
}

// The provider component
export const WalletProvider = ({ children }: WalletProviderProps) => {
  // State for wallet connection
  const [walletState, setWalletState] = useState<WalletConnectionState>({
    connected: false,
    address: "",
    publicKey: "",
    type: null,
  });

  // Reference to the current wallet adapter
  const [walletAdapter, setWalletAdapter] = useState<WalletAdapter | null>(null);

  // List of available wallets
  const availableWallets = Object.values(WalletType);

  // Function to connect to a wallet
  const connect = useCallback(async (walletType: WalletType) => {
    try {
      // Create a new wallet adapter for the selected wallet
      const adapter = createWalletAdapter(walletType);
      
      // Connect to the wallet
      const { address, publicKey } = await adapter.connect();

      // Update the wallet state
      setWalletState({
        connected: true,
        address,
        publicKey,
        type: walletType,
      });
      
      // Save the adapter for later use
      setWalletAdapter(adapter);
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      throw error;
    }
  }, []);

  // Function to disconnect from a wallet
  const disconnect = useCallback(async () => {
    try {
      if (walletAdapter) {
        await walletAdapter.disconnect();
      }
      
      // Reset the wallet state
      setWalletState({
        connected: false,
        address: "",
        publicKey: "",
        type: null,
      });
      
      // Clear the wallet adapter
      setWalletAdapter(null);
    } catch (error) {
      console.error('Error disconnecting from wallet:', error);
      throw error;
    }
  }, [walletAdapter]);

  // Function to sign a PSBT
  const signPSBT = useCallback(async (psbtHex: string, inputsToSign: number[]) => {
    if (!walletAdapter) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const signedPsbtHex = await walletAdapter.signPSBT(psbtHex, inputsToSign);
      return signedPsbtHex;
    } catch (error) {
      console.error('Error signing PSBT:', error);
      throw error;
    }
  }, [walletAdapter]);

  // Provide the wallet state and functions to the children
  return (
      <WalletContext.Provider
        value={{
          walletState,
          connect,
          disconnect,
          availableWallets,
          signPSBT,
        }}
        >
        {children}
      </WalletContext.Provider>
  );
};
