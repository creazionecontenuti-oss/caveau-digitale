import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";

const polygonConfig = {
  type: "http",
  url: "https://polygon.llamarpc.com",
  chainId: 137
};

// Only add accounts if the private key is a valid hex string
const pk = process.env.DEPLOYER_PRIVATE_KEY || "";
if (/^0x[0-9a-fA-F]{64}$/.test(pk)) {
  polygonConfig.accounts = [pk];
}

export default {
  solidity: {
    version: "0.8.20",
    settings: { viaIR: true, optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    polygon: polygonConfig
  }
};
