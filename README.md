# Liquidium Recovery Tool

**This is an emergency recovery tool** designed to help you regain access to funds locked in a multisig Bitcoin vault. It sweeps all funds from your Liquidium Instant Loan Vault into a personal wallet address you control, using your private key and the vault’s public key. Built specifically for Liquidium—a peer-to-peer Bitcoin asset lending app—this open-source tool ensures you’re never locked out of your BTC in a crisis.

**No license required**: This project is fully open-source, free to use, fork, or adapt by anyone.

**Legal Notice**: The Liquidium Vault Recovery Tool is provided as a free and open-source utility for community use. It is offered as-is, without any warranty—express or implied—including but not limited to warranties of merchantability or fitness for a particular purpose. Use at your own risk. The Liquidium team assumes no liability for loss, damage, or other issues arising from the use of this tool.

**Live Site**: (https://liquidium-inc.github.io/liquidium-recovery-tool/)

## Overview

The Liquidium Recovery Tool is a web application built with Vite and TypeScript, intended **solely for emergency use**. For regular withdrawals, use the Liquidium app. This tool lets you connect a Bitcoin wallet via your browser and transfer all funds from a Liquidium ICP multisig vault (1-of-2 P2SH setup) to an address you own. It simplifies fetching unspent transaction outputs (UTXOs), crafting a transaction, signing it, and broadcasting it to the Bitcoin network—all with just your private key and the vault’s public key.

Anyone can inspect, modify, or repurpose this code—it’s open-source and unencumbered by licensing restrictions.

## Features

- User-friendly interface for non-technical users
- Compatible with multiple wallet providers (e.g., Xverse, Unisat, Leather)
- Real-time fee rate suggestions from mempool.space
- Transaction creation and signing powered by bitcoinjs-lib
- Tailored for Liquidium’s 1-of-2 P2SH multisig vaults
- Robust error messages and input validation
- Transaction details displayed post-broadcast

## What It Does

This tool “sweeps” funds from your Liquidium multisig vault to your connected wallet in an emergency. Here’s the process:

1. **Connect Your Wallet**: Link your browser wallet to the tool.
2. **Enter Vault Details**:
   - **Vault Public Key**: Safe to share; saved when you created your vault or found in Liquidium settings.
   - **Vault Address**: Available in Liquidium’s profile menu or your on-chain transaction history.
3. **Set the Fee**: Pick a network fee rate to control confirmation speed (paid from the vault’s BTC).
4. **Recover Funds**: Hit “Recover Funds” to generate a transaction withdrawing all vault funds to your wallet.
5. **Sign the Transaction**: Review it in your wallet—verify inputs are from the vault’s UTXOs and the output goes to your address.
6. **Done**: The tool broadcasts the transaction, and your funds land in your wallet.

## Forking and Running Locally (For Non-Developers)

This tool is open-source—fork it, tweak it, or run it yourself! Here’s a beginner-friendly guide:

### Step 1: Prerequisites
- **A Computer**: Works on Windows, Mac, or Linux.
- **Node.js**: Download the LTS version (e.g., 18+) from [nodejs.org](https://nodejs.org/) and install it. This includes `npm` for managing project files.

### Step 2: Fork the Repository
1. **Join GitHub**: Sign up at [github.com](https://github.com) if you haven’t.
2. **Locate the Project**: Visit `https://github.com/yourusername/liquidium-recovery-tool` (replace `yourusername` with the actual owner’s username).
3. **Fork It**:
   - Click “Fork” at the top-right to copy it to your account (e.g., `https://github.com/yourusername/liquidium-recovery-tool`).
   - Select “Create Fork”.

### Step 3: Download Your Fork
1. **Access Your Fork**: Go to your copy (e.g., `https://github.com/yourusername/liquidium-recovery-tool`).
2. **Download**:
   - Click the green “Code” button > “Download ZIP”.
   - Save the ZIP file (e.g., to your Desktop).
3. **Extract**:
   - Unzip it (double-click or right-click > “Extract All”) to get a folder like `liquidium-recovery-tool-main`.

### Step 4: Set Up the Project
1. **Open a Terminal**:
   - **Windows**: `Win + R` > `cmd` > Enter.
   - **Mac**: Spotlight > “Terminal”.
   - **Linux**: Open your terminal.
2. **Navigate to the Folder**:
   - Example: `cd Desktop/liquidium-recovery-tool-main` (adjust path as needed).
3. **Install Dependencies**:
   - Run `npm install` and wait for it to finish downloading required files.

### Step 5: Run the Tool Locally
1. **Launch It**:
   - Run `npm run dev`—you’ll see “Ready on http://localhost:3001” when it starts.
2. **Open in Browser**:
   - Visit `http://localhost:3001` in Chrome, Firefox, etc., to use the tool.

### Stopping the Tool
- Press `Ctrl + C` in the terminal to shut it down.

## Using the Tool
1. **Connect Wallet**: Select your provider (e.g., Xverse).
2. **Input Details**:
   - Vault Public Key (from Liquidium settings).
   - Vault Address (from Liquidium or transaction history).
   - Fee rate (use the suggestion or tweak it).
3. **Sweep Funds**: Click “Recover Funds” to transfer BTC.
4. **Verify**: Check the transaction ID on mempool.space.

## Troubleshooting
- **Node.js Issues**: Confirm installation with `node -v`.
- **Wallet Connection Fails**: Ensure your wallet extension is installed and unlocked.
- **Install Errors**: Retry `npm install` or check your network.

## Project Structure
- `/src/app`: Core web pages
- `/src/components`: UI elements (wallet connect, forms)
- `/src/lib`: Bitcoin transaction utilities

## Dependencies
- Vite, TypeScript, React: Web app framework
- bitcoinjs-lib, tiny-secp256k1: Transaction handling
- sats-connect: Wallet integration

## Support
Questions? File an issue at `https://github.com/yourusername/liquidium-recovery-tool/issues`.

## Acknowledgements
- [bitcoinjs-lib](https://github.com/bitcoinjs/bitcoinjs-lib)
- [mempool.space](https://mempool.space)
- [Vite](https://vitejs.dev/)
