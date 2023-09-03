import { ethers } from "hardhat";
import * as readline from "readline";
import { Spades, Spades__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ProviderDisconnectedError } from "viem";



const hre = require("hardhat");

let accounts:   HardhatEthersSigner[];
let Sigwallet: Spades;

async function main() {
    await initAccounts();
    await initContract();
    // const rl = readline.createInterface({
    //     input: process.stdin,
    //     output: process.stdout,
    //   });
    //   mainMenu(rl);
    }

    /// Init accounts;
    /// --------------------

async function initAccounts() {
    accounts = await ethers.getSigners();
}

    /// Deploying contract;
    /// ---------------------

async function initContract() {

    const contractFactory = new Spades__factory(accounts[0]);
    const contract = await contractFactory.deploy([accounts[0], accounts[1], accounts[2]], 2, {value: 100});
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log(`Token contract deployed at ${contractAddress} with owners: 
    ${accounts[0].address}\n
     ${accounts[1].address}\n
      ${accounts[2].address} \n`); 

    const balance = await ethers.provider.getBalance(contractAddress);
    console.log(`Token contract has ${balance} of balance`); 
}

    /// TODO: Menu Options

    


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});