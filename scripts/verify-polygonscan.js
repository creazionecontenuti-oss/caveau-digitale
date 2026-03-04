import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, basename, dirname, join } from "path";

// ─── Config ────────────────────────────────────────────────────
// Etherscan V2 API (unified endpoint with chainid in URL)
const POLYGONSCAN_API = "https://api.etherscan.io/v2/api?chainid=137";
const API_KEY = process.env.POLYGONSCAN_API_KEY;

const CONTRACTS = [
  {
    name: "CaveauDigitaleV2",
    address: "0x1FcbF2A6456aF7435c868666Be25774d92c2BA06",
    file: "contracts/CaveauDigitaleV2.sol",
  },
  {
    name: "CaveauAave",
    address: "0xDF9c64E845C0E9D54175C7d567d5d0e0b9EE3501",
    file: "contracts/CaveauAave.sol",
  },
];

// ─── Build Standard JSON Input ─────────────────────────────────
function buildStandardJsonInput(contractFile) {
  const sources = {};

  // sourceKey = the path used as key in sources{} (what the compiler sees)
  // diskPath  = actual filesystem path to read the file content
  function addFile(sourceKey, diskPath) {
    if (sources[sourceKey]) return;
    const content = readFileSync(diskPath, "utf8");
    sources[sourceKey] = { content };

    const importRegex = /import\s+(?:\{[^}]*\}\s+from\s+)?["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const raw = match[1];
      let childKey, childDisk;

      if (raw.startsWith("@")) {
        // Absolute package import: @openzeppelin/contracts/...
        childKey = raw;
        childDisk = join("node_modules", raw);
      } else if (raw.startsWith(".")) {
        // Relative import: resolve against BOTH sourceKey dir and diskPath dir
        childKey = resolve(dirname(sourceKey), raw)
          .replace(process.cwd() + "/", "");
        childDisk = resolve(dirname(diskPath), raw);
      } else {
        childKey = raw;
        childDisk = raw;
      }

      addFile(childKey, childDisk);
    }
  }

  addFile(contractFile, contractFile);

  return JSON.stringify({
    language: "Solidity",
    sources,
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode", "evm.deployedBytecode"] },
      },
    },
  });
}

// ─── Verify via Polygonscan API ────────────────────────────────
async function verifyContract(contract) {
  console.log(`\n🔍 Verifying ${contract.name} at ${contract.address}...`);

  const standardJsonInput = buildStandardJsonInput(contract.file);

  const params = new URLSearchParams({
    apikey: API_KEY,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: contract.address,
    sourceCode: standardJsonInput,
    codeformat: "solidity-standard-json-input",
    contractname: `${contract.file}:${contract.name}`,
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
  });

  const res = await fetch(POLYGONSCAN_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (data.status === "1") {
    console.log(`⏳ Verification submitted! GUID: ${data.result}`);
    console.log("   Checking status in 30 seconds...");

    // Poll for result
    await new Promise((r) => setTimeout(r, 30000));
    const checkParams = new URLSearchParams({
      apikey: API_KEY,
      module: "contract",
      action: "checkverifystatus",
      guid: data.result,
    });

    const checkRes = await fetch(`${POLYGONSCAN_API}&${checkParams}`);
    const checkData = await checkRes.json();
    console.log("Status:", JSON.stringify(checkData, null, 2));

    if (checkData.result === "Pass - Verified") {
      console.log(`✅ ${contract.name} verified on Polygonscan!`);
      console.log(
        `🔗 https://polygonscan.com/address/${contract.address}#code`
      );
    } else {
      console.log(`⚠️ Status: ${checkData.result}`);
      console.log("   It may take a few more minutes. Check manually:");
      console.log(
        `   https://polygonscan.com/address/${contract.address}#code`
      );
    }
  } else {
    console.error(`❌ Verification failed: ${data.result}`);
  }
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  if (!API_KEY) {
    console.error("❌ POLYGONSCAN_API_KEY not set in .env");
    console.error("");
    console.error("To get a free API key:");
    console.error("  1. Go to https://polygonscan.com/register");
    console.error("  2. Create an account");
    console.error("  3. Go to https://polygonscan.com/myapikey");
    console.error("  4. Create a new API key");
    console.error('  5. Add POLYGONSCAN_API_KEY=your_key_here to .env');
    process.exit(1);
  }

  for (const contract of CONTRACTS) {
    await verifyContract(contract);
  }
}

main().catch(console.error);
