// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  async function main() {
    const [deployer] = await ethers.getSigners();
  
    console.log("Deploying contracts with the account:", owner1.address);
  
    const wallet = await ethers.deployContract("Spades");
  
    console.log("Spades address:", await wallet.getAddress());
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
