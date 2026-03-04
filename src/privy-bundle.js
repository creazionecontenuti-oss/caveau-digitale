// Privy SDK bundle entry point
// This file is bundled by esbuild into privy-sdk.js for browser use
// Run: npm run build:privy

import PrivyClient from '@privy-io/js-sdk-core';
import { getUserEmbeddedEthereumWallet } from '@privy-io/js-sdk-core';

// Expose on the global __PrivySDK namespace
export { PrivyClient, getUserEmbeddedEthereumWallet };
