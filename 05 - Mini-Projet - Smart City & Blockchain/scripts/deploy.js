const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const c = await hre.ethers.deployContract("UrbanIssueRegistry");
  await c.waitForDeployment();
  const address = await c.getAddress();
  console.log("UrbanIssueRegistry deployed to:", address);
  fs.writeFileSync("frontend/.env.local", `VITE_CONTRACT_ADDRESS=${address}\n`);
  console.log("Wrote frontend/.env.local");
}

main().catch((e) => { console.error(e); process.exit(1); });
