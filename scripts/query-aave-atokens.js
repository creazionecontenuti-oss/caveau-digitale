import { ethers } from "ethers";

// Aave V3 Pool on Polygon
const POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const POOL_ABI = [
  "function getReserveData(address asset) view returns (tuple(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128))"
];

// Aave V3 PoolDataProvider on Polygon
const DATA_PROVIDER = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654";
const DATA_PROVIDER_ABI = [
  "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)"
];

const TOKENS = {
  USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  "USDC.e": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  DAI:  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

async function main() {
  const provider = new ethers.JsonRpcProvider("https://1rpc.io/matic");
  const dp = new ethers.Contract(DATA_PROVIDER, DATA_PROVIDER_ABI, provider);

  console.log("Querying Aave V3 PoolDataProvider on Polygon...\n");

  for (const [name, addr] of Object.entries(TOKENS)) {
    try {
      const result = await dp.getReserveTokensAddresses(addr);
      console.log(`${name} (${addr}):`);
      console.log(`  aToken: ${result.aTokenAddress}`);
      console.log(`  stableDebt: ${result.stableDebtTokenAddress}`);
      console.log(`  variableDebt: ${result.variableDebtTokenAddress}`);
      console.log();
    } catch (e) {
      console.log(`${name}: NOT SUPPORTED on Aave V3 Polygon (${e.message?.slice(0, 80)})\n`);
    }
  }
}

main().catch(console.error);
