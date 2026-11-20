"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
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

// Highest fee rate (sat/vB) accepted from the fee API as the default, and the
// rate above which a manually entered fee needs explicit confirmation.
const MAX_SANE_FEE_RATE = 500;
// Share of the swept funds above which the fee needs explicit confirmation.
const MAX_SANE_FEE_SHARE = 0.1;
// Rough virtual size (vB) of one vault input, used for the fee estimate
const INPUT_VSIZE = 150;
// Smallest output every wallet address type can relay (P2PKH dust limit)
const DUST_LIMIT = 546;

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
  const [skippedNotice, setSkippedNotice] = useState<string | null>(null);
  const [mediumFeeRate, setMediumFeeRate] = useState<number | null>(null);
  const [isFetchingFeeRate, setIsFetchingFeeRate] = useState(false);
  // Set once the user edits the fee rate, so a late API answer can't replace it
  const feeRateEdited = useRef(false);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof FormData, string>>
  >({});

  // Fetch fee rate on component mount
  useEffect(() => {
    const getMediumFeeRate = async () => {
      setIsFetchingFeeRate(true);
      try {
        const { hourFee } = await fetchFeeRates();
        // Don't trust an implausible recommendation from the third-party API
        if (
          !Number.isFinite(hourFee) ||
          hourFee < 1 ||
          hourFee > MAX_SANE_FEE_RATE
        ) {
          throw new Error(`Implausible fee rate from API: ${hourFee}`);
        }
        const feeRate = Math.ceil(hourFee);
        setMediumFeeRate(feeRate);
        // Update the form with the medium fee rate
        if (!feeRateEdited.current) {
          setFormData((prev) => ({ ...prev, feeRate }));
        }
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
    if (name === "feeRate") feeRateEdited.current = true;
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
    setSkippedNotice(null);
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
    setSkippedNotice(null);

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
      const allUtxos = await fetchUTXOs(formData.multisigAddress);

      if (!allUtxos || allUtxos.length === 0) {
        throw new Error("No UTXOs found for this multisig address");
      }

      // Leave out outputs worth no more than the fee to spend them. Anyone can
      // send small outputs to the vault address, and sweeping them would only
      // lower the amount recovered or push the fee above the vault's balance.
      const inputFee = INPUT_VSIZE * formData.feeRate;
      const utxos = allUtxos.filter((utxo) => utxo.value > inputFee);
      const skipped = allUtxos.filter((utxo) => utxo.value <= inputFee);
      const skippedAmount = skipped.reduce((sum, utxo) => sum + utxo.value, 0);

      if (utxos.length === 0) {
        throw new Error(
          `All ${allUtxos.length} outputs at this address are worth no more than ` +
            `the ${inputFee} sats it costs to spend each one at ` +
            `${formData.feeRate} sat/vB. Try a lower fee rate.`,
        );
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
      const estimatedTxSize = utxos.length * INPUT_VSIZE + 34 + 10; // inputs + output + overhead

      // 6. Calculate fee
      const fee = estimatedTxSize * formData.feeRate;

      // 7. Ensure the amount left after the fee can be relayed
      if (totalAmount - fee < DUST_LIMIT) {
        throw new Error(
          `Not enough funds left after the ${fee} sat fee to send to your wallet`,
        );
      }

      // 8. Calculate final amount after deducting fee
      const finalAmount = totalAmount - fee;

      // Ask before paying an unusually high fee
      if (
        (formData.feeRate > MAX_SANE_FEE_RATE ||
          fee > totalAmount * MAX_SANE_FEE_SHARE) &&
        !window.confirm(
          `The network fee is unusually high: ${fee} sats ` +
            `(${((fee / totalAmount) * 100).toFixed(1)}% of the vault's ` +
            `${totalAmount} sats) at ${formData.feeRate} sat/vB. You will ` +
            `receive ${finalAmount} sats. Continue?`,
        )
      ) {
        throw new Error("Cancelled: fee is too high");
      }

      // 9. Add output to send funds to user's wallet
      psbt.addOutput({
        address: walletState.address,
        value: BigInt(finalAmount),
      });

      // Tell the user about left-out outputs before they sign
      if (skipped.length > 0) {
        setSkippedNotice(
          `${skipped.length} output(s) worth ${skippedAmount} sats in total ` +
            `are left out of this recovery: spending them at ` +
            `${formData.feeRate} sat/vB would cost at least as much as they ` +
            `hold. You may be able to recover them later at a lower fee rate.`,
        );
      }

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

        // 15. Broadcast the transaction and show its verified ID
        setTransactionId(await broadcastTransaction(rawTx));
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

      {/* Left-out outputs */}
      {skippedNotice && (
        <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md text-sm">
          {skippedNotice}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Transaction Success */}
      {transactionId && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-md">
          <p className="font-semibold">Transaction accepted by mempool.space</p>
          <p className="mt-1 text-sm">
            Your funds are recovered once it confirms. Check that it shows up
            in your wallet.
          </p>
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
