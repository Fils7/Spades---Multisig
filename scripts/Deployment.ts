
import { ethers } from "hardhat";
import { Spades, Spades__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

import { waitForDebugger } from "inspector";
import { utils } from "mocha";


let accounts:   HardhatEthersSigner[];
let contract: Spades;

const hre = require("hardhat");

async function main() {
    try {

        ///Init accounts
        accounts = await ethers.getSigners();

        /// Deploying contract;
        /// ---------------------

        const contractFactory = new Spades__factory(accounts[0]);
        const contract = await contractFactory.deploy([accounts[0], accounts[1], accounts[2]], 2, {value: 100});
        await contract.waitForDeployment();
        const spadesAddress= await contract.getAddress();

        console.log(`Spades contract deployed at ${spadesAddress} with owners:\n 
        ${accounts[0].address}\n
        ${accounts[1].address}\n
        ${accounts[2].address} \n`); 

        const balance = await ethers.provider.getBalance(spadesAddress);
        console.log(`Spades contract has ${balance} ethers of balance`); 
        
        // Submit a transaction
        // Define 'amount' and 'data' here with appropriate values

        const amount = ethers.parseUnits("2"); // Replace with desired amount
        const binaryData = new Uint8Array([0x17, 0x60, 0x6c, 0x4c, 0x6f]);
        const data = ethers.keccak256(binaryData);

        const tx = await contract.connect(accounts[1]).submit(accounts[2], amount, data);
        const receipt = await tx.wait();
            
        console.log(`Submitted transaction from ${accounts[1].address}:\n 
        With the hash: ${receipt?.hash}\n`);

        // Fetching the submited transaction
        console.log("Fetching a submited transaction at index (0):\n");
        
        const seeTransaction = await contract.getTransaction(0);
        console.log(`${seeTransaction}`);

        // Signing a transaction 
        // Index [0] with accounts [0]
        const signature = contract.connect(accounts[0]).signTransaction(0);
        await signature;

        console.log(`\nAccount with address ${accounts[0].address}
        signed the tx with index 0\n`);

        // See who already signed tx [0]
        // Passing address [2] should give false
        const seeSignatures = await contract.seeIfSigned(0, accounts[2].address);
        await seeSignatures;

        console.log(`The account ${accounts[2].address} signed this tx: ${seeSignatures}`);

        // Passing address [0] should give true
        const accountSignature = await contract.seeIfSigned(0, accounts[0].address);
        await accountSignature;

        console.log(`The account ${accounts[0].address} signed the tx: ${accountSignature}`);

        // Passing address [1] should give true
        const firstSignature = await contract.seeIfSigned(0, accounts[1].address);
        await firstSignature;

        console.log(`The account ${accounts[0].address} signed the tx: ${firstSignature}`);

        // Revoke a confirmation
        //TODO


        // Sign the transaction again
        //TODO


        // Execute the transaction
        // TODO

        
        // Fetch contract balance
        //TODO

        
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
