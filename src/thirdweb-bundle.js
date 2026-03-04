// Thirdweb SDK bundle entry point
// This file is bundled by esbuild into thirdweb-sdk.js for browser use
// Run: npm run build:thirdweb

import { createThirdwebClient } from 'thirdweb';
import { inAppWallet, preAuthenticate, linkProfile, getProfiles } from 'thirdweb/wallets/in-app';
import { polygon } from 'thirdweb/chains';
import { ethers6Adapter } from 'thirdweb/adapters/ethers6';

// Expose on the global __ThirdwebSDK namespace
export { createThirdwebClient, inAppWallet, preAuthenticate, linkProfile, getProfiles, polygon, ethers6Adapter };
