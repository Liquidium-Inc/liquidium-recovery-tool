"use client";

import { useState, useEffect, FormEvent } from "react";
import { useWallet } from "./WalletProvider";
import { FormData } from "../lib/types";
import { fetchUTXOs, fetchFeeRates, broadcastTransaction } from "../lib/api";
import {
  bitcoin,
  isValidBitcoinAddress,
  isValidPublicKey,
  NETWORK,
} from "../lib/bitcoinConfig";
import { Buffer } from "buffer";

export const Form = () => {
  // Get wallet state and functions from the wallet provider
  const { walletState, signPSBT } = useWallet();

  // Form state
  const [formData, setFormData] = useState<FormData>({
    publicKey: "",
    multisigAddress: "",
    feeRate: 50,
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [mediumFeeRate, setMediumFeeRate] = useState<number | null>(null);
  const [isFetchingFeeRate, setIsFetchingFeeRate] = useState(false);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({});

  // Fetch fee rate on component mount
  useEffect(() => {
    const getMediumFeeRate = async () => {
      setIsFetchingFeeRate(true);
      try {
        const feeRates = await fetchFeeRates();
        setMediumFeeRate(feeRates.hourFee);
        // Update the form with the medium fee rate
        setFormData((prev) => ({ ...prev, feeRate: feeRates.hourFee }));
      } catch (error) {
        console.error("Error fetching fee rates:", error);
        setError("Failed to fetch fee rates. Using default value.");
      } finally {
        setIsFetchingFeeRate(false);
      }
    };

    getMediumFeeRate();
  }, []);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "feeRate" ? parseInt(value) || 0 : value,
    }));

    // Clear validation error when user types
    if (validationErrors[name as keyof FormData]) {
      setValidationErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    // Clear transaction ID and error when form changes
    setTransactionId(null);
    setError(null);
  };

  // Validate form data
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    // Validate multisig public key
    if (!formData.publicKey) {
      errors.publicKey = "Multisig public key is required";
    } else if (!isValidPublicKey(formData.publicKey)) {
      errors.publicKey = "Invalid public key format";
    }

    // Validate multisig address
    if (!formData.multisigAddress) {
      errors.multisigAddress = "Multisig multisigAddress is required";
    } else if (!isValidBitcoinAddress(formData.multisigAddress)) {
      errors.multisigAddress = "Invalid Bitcoin address";
    }

    // Validate fee rate
    if (!formData.feeRate || formData.feeRate < 1) {
      errors.feeRate = "Fee rate must be at least 1 sat/vB";
    }

    // Update validation errors state
    setValidationErrors(errors);

    // Return true if there are no errors
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear previous errors and transaction ID
    setError(null);
    setTransactionId(null);

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Check if wallet is connected
    if (!walletState.connected || !walletState.address) {
      setError("Please connect your wallet first");
      return;
    }

    // Start submission process
    setIsSubmitting(true);

    try {
      // 1. Fetch UTXOs from the multisig address
      const utxos = await fetchUTXOs(formData.multisigAddress);

      if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs found for this multisig address");
      }

      // 2. Calculate total amount from UTXOs
      const totalAmount = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

      // 3. Create a new PSBT
      const psbt = new bitcoin.Psbt({ network: NETWORK });

      // 4. Add inputs from UTXOs
      utxos.forEach((utxo) => {
        const multisigScript = bitcoin.payments.p2ms({
          m: 1,
          pubkeys: [
            // Multisig public key
            Buffer.from(formData.publicKey, "hex"),
            // User's wallet public key
            Buffer.from(walletState.publicKey, "hex"),
          ],
          network: NETWORK,
        });

        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.address.toOutputScript(formData.multisigAddress, NETWORK),
            value: BigInt(utxo.value),
          },
          witnessScript: multisigScript.output,
        });
      });

      // 5. Estimate transaction size (very rough estimate)
      const estimatedTxSize = utxos.length * 150 + 34 + 10; // inputs + output + overhead

      // 6. Calculate fee
      const fee = estimatedTxSize * formData.feeRate;

      // 7. Ensure fee is not more than total amount
      if (fee >= totalAmount) {
        throw new Error("Fee is higher than available funds");
      }

      // 8. Calculate final amount after deducting fee
      const finalAmount = totalAmount - fee;

      // 9. Add output to send funds to user's wallet
      psbt.addOutput({
        address: walletState.address,
        value: BigInt(finalAmount),
      });

      // 10. Get the PSBT hex for signing
      const psbtHex = psbt.toHex();

      console.log("Unsigned PSBT Hex:", psbtHex);

      try {
        // 11. Sign the PSBT with the wallet
        const signedPsbtHex = await signPSBT(
          psbtHex,
          utxos.map((_, index) => index),
        );

        console.log("Signed PSBT Hex:", signedPsbtHex);

        // 12. Parse the signed PSBT
        const signedPsbt = bitcoin.Psbt.fromHex(signedPsbtHex, {
          network: NETWORK,
        });

        // 13. Finalize the PSBT
        signedPsbt.finalizeAllInputs();

        // 14. Extract the raw transaction
        const rawTx = signedPsbt.extractTransaction().toHex();
        console.log("Raw PBST Transaction:", rawTx);

        // 15. Broadcast the transaction
        const response = await broadcastTransaction(rawTx);

        // 16. Set the transaction ID
        setTransactionId(response.txid);
      } catch (signError) {
        console.error("Error during PSBT signing or processing:", signError);
        throw signError; // Re-throw to be caught by the outer try/catch
      }
    } catch (error) {
      console.error("Error submitting transaction:", error);
      setError(`Error: ${(error as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-black">
        Multisig Recovery Tool
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Multisig Public Key Input */}
        <div className="mb-4">
          <label
            htmlFor="publicKey"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Multisig Public Key (hex)
          </label>
          <input
            type="text"
            id="publicKey"
            name="publicKey"
            value={formData.publicKey}
            onChange={handleChange}
            placeholder="Enter multisig public key (hex)"
            className={`w-full px-3 py-2 border ${
              validationErrors.publicKey ? "border-red-500" : "border-gray-300"
            } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black`}
          />
          {validationErrors.publicKey && (
            <p className="mt-1 text-sm text-red-600">
              {validationErrors.publicKey}
            </p>
          )}
        </div>

        {/* Multisig Address Input */}
        <div className="mb-4">
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Multisig Address
          </label>
          <input
            type="text"
            id="address"
            name="multisigAddress"
            value={formData.multisigAddress}
            onChange={handleChange}
            placeholder="Enter multisig address"
            className={`w-full px-3 py-2 border ${
              validationErrors.multisigAddress ? "border-red-500" : "border-gray-300"
            } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black`}
          />
          {validationErrors.multisigAddress && (
            <p className="mt-1 text-sm text-red-600">
              {validationErrors.multisigAddress}
            </p>
          )}
        </div>

        {/* Fee Rate Input */}
        <div className="mb-6">
          <label
            htmlFor="feeRate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Fee Rate (sat/vB)
          </label>
          <div className="flex items-center">
            <input
              type="number"
              id="feeRate"
              name="feeRate"
              value={formData.feeRate}
              onChange={handleChange}
              min="1"
              placeholder="Enter fee rate (e.g., 150)"
              className={`w-full px-3 py-2 border ${
                validationErrors.feeRate ? "border-red-500" : "border-gray-300"
              } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black`}
            />
            <div className="ml-2 text-sm text-gray-600 whitespace-nowrap">
              {isFetchingFeeRate ? (
                "Fetching fee rate..."
              ) : mediumFeeRate ? (
                <span>(Current medium fee rate: {mediumFeeRate} sat/vB)</span>
              ) : null}
            </div>
          </div>
          {validationErrors.feeRate && (
            <p className="mt-1 text-sm text-red-600">
              {validationErrors.feeRate}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !walletState.connected}
          className={`w-full py-2 px-4 rounded-md text-white font-medium ${
            isSubmitting || !walletState.connected
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
        >
          {isSubmitting ? "Processing..." : "Recover Funds"}
        </button>

        {!walletState.connected && (
          <p className="mt-2 text-sm text-orange-600 text-center">
            Please connect your wallet first
          </p>
        )}
      </form>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Transaction Success */}
      {transactionId && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-md">
          <p className="font-semibold">Transaction Successfully Broadcast!</p>
          <p className="mt-1 break-all">
            <a
              href={`https://mempool.space/tx/${transactionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {transactionId}
            </a>
          </p>
        </div>
      )}
    </div>
  );
};
