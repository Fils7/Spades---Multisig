import { ethers } from "hardhat";
import { Spades, Spades__factory, SpadesFactory, SpadesFactory__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

async function main() {
    try {
        // Get accounts
        const accounts = await ethers.getSigners();
        
        // Deploy the factory first
        console.log("Deploying SpadesFactory...");
        const factoryFactory = new SpadesFactory__factory(accounts[0]);
        const factory = await factoryFactory.deploy();
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        console.log(`SpadesFactory deployed at ${factoryAddress}`);

        // Create a new wallet through the factory
        console.log("Creating new Spades wallet...");
        const owners = [accounts[0].address, accounts[1].address, accounts[2].address];
        const requiredSignatures = 2;
        
        const createTx = await factory.createWallet(
            owners,
            requiredSignatures
        );
        
        const receipt = await createTx.wait();
        
        if (!receipt) {
            throw new Error("Transaction failed");
        }

        // Get the wallet address from the WalletCreated event
        const walletCreatedEvent = receipt.logs.find(
            (log) => {
                try {
                    return factory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    })?.name === "WalletCreated"
                } catch {
                    return false;
                }
            }
        );

        if (!walletCreatedEvent) {
            throw new Error("WalletCreated event not found");
        }

        const parsedLog = factory.interface.parseLog({
            topics: walletCreatedEvent.topics as string[],
            data: walletCreatedEvent.data
        });

        const walletAddress = parsedLog?.args[0];
        console.log(`New Spades wallet deployed at ${walletAddress}`);
        
        // Get wallet instance
        const wallet = Spades__factory.connect(walletAddress, accounts[0]);
        
        // Send 1 ETH to the wallet
        console.log("\nSending 1 ETH to wallet...");
        const fundTx = await accounts[0].sendTransaction({
            to: walletAddress,
            value: ethers.parseEther("1.0")
        });
        await fundTx.wait();
        console.log("Funding transaction completed");
        
        // Log wallet details
        console.log("\nWallet Details:");
        console.log(`Owners: ${owners.join(", ")}`);
        console.log(`Required signatures: ${requiredSignatures}`);
        const balance = await ethers.provider.getBalance(walletAddress);
        console.log(`Initial balance: ${ethers.formatEther(balance)} ETH`);

    } catch (error) {
        console.error("Deployment failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });