import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "fs";

// aToken addresses from Aave V3 PoolDataProvider on Polygon
const AAVE_TOKENS = {
  // USDC native → aPolUSDCn
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359": "0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD",
  // DAI → aPolDAI
  "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063": "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
  // USDT → aPolUSDT
  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F": "0x6ab707Aca953eDAeFBc4fD23bA73294241490620",
};

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    console.error("❌ DEPLOYER_PRIVATE_KEY mancante o non valida nel file .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("https://1rpc.io/matic");
  const wallet = new ethers.Wallet(pk, provider);
  console.log("Deploying CaveauAave with account:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");

  if (balance === 0n) {
    console.error("❌ Serve MATIC per il gas!");
    process.exit(1);
  }

  // Step 1: Deploy contract
  const artifact = JSON.parse(
    readFileSync("artifacts/contracts/CaveauAave.sol/CaveauAave.json", "utf8")
  );

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("📦 Deploying CaveauAave...");
  const caveau = await factory.deploy();
  console.log("TX:", caveau.deploymentTransaction().hash);
  await caveau.waitForDeployment();
  const address = await caveau.getAddress();
  console.log("✅ CaveauAave deployed at:", address);
  console.log("🔗 https://polygonscan.com/address/" + address + "\n");

  // Step 2: Register aToken addresses
  console.log("📝 Registering aToken addresses...");
  for (const [token, aToken] of Object.entries(AAVE_TOKENS)) {
    console.log(`  setAToken(${token}, ${aToken})`);
    const tx = await caveau.setAToken(token, aToken);
    await tx.wait();
    console.log("  ✅ Done");
  }

  console.log("\n🎉 CaveauAave fully deployed and configured!");
  console.log("📍 Contract address:", address);
  console.log("\n👉 Add CAVEAU_AAVE_CONTRACT =", `'${address}'`, "to app.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
