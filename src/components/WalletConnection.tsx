"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { WalletType } from "../lib/types";

export const WalletConnection = () => {
  const { walletState, connect, disconnect, availableWallets } = useWallet();
  const [showWalletOptions, setShowWalletOptions] = useState(false);

  // Format address for display
  const formatAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  // Handle wallet connection
  const handleConnect = async (walletType: WalletType) => {
    try {
      await connect(walletType);
      setShowWalletOptions(false);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert(`Failed to connect wallet: ${(error as Error).message}`);
    }
  };

  // Handle wallet disconnection
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      alert(`Failed to disconnect wallet: ${(error as Error).message}`);
    }
  };

  // Toggle wallet options panel
  const toggleWalletOptions = () => {
    setShowWalletOptions(!showWalletOptions);
  };

  return (
    <div className="relative">
      {/* Connect/Disconnect Button */}
      <button
        onClick={walletState.connected ? handleDisconnect : toggleWalletOptions}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
      >
        {walletState.connected
          ? `Connected: ${formatAddress(walletState.address!)}`
          : "Connect Wallet"}
      </button>

      {/* Wallet Options Panel */}
      {showWalletOptions && !walletState.connected && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-10 border border-gray-200">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 font-semibold border-b">
              Select Wallet
            </div>
            {availableWallets.map((wallet) => (
              <button
                key={wallet}
                onClick={() => handleConnect(wallet)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                {wallet}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
