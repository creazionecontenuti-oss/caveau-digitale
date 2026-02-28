import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "fs";

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    console.error("❌ DEPLOYER_PRIVATE_KEY mancante o non valida nel file .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider("https://1rpc.io/matic");
  const wallet = new ethers.Wallet(pk, provider);
  console.log("Deploying CaveauDigitale with account:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");

  if (balance === 0n) {
    console.error("❌ Serve MATIC per il gas! Manda almeno 0.1 MATIC a", wallet.address);
    process.exit(1);
  }

  // Read compiled artifact from Hardhat output
  const artifact = JSON.parse(
    readFileSync("artifacts/contracts/CaveauDigitale.sol/CaveauDigitale.json", "utf8")
  );

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying...");
  const caveau = await factory.deploy();
  console.log("TX inviata:", caveau.deploymentTransaction().hash);
  console.log("Attendi conferma...");
  await caveau.waitForDeployment();

  const address = await caveau.getAddress();
  console.log("\n✅ CaveauDigitale deployato su Polygon!");
  console.log("📍 Indirizzo contratto:", address);
  console.log("🔗 PolygonScan: https://polygonscan.com/address/" + address);
  console.log("\n👉 Sostituisci CAVEAU_CONTRACT in app.js con questo indirizzo");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
