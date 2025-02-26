import { ethers } from "hardhat";

async function main() {
    try {
        // 1. Deploy the Spades implementation (singleton)
        console.log("Deploying Spades implementation...");
        const Spades = await ethers.getContractFactory("Spades");
        const implementation = await Spades.deploy();
        await implementation.waitForDeployment();
        const implementationAddress = await implementation.getAddress();
        console.log(`Spades implementation deployed at ${implementationAddress}`);

        // 2. Deploy the factory with implementation address
        console.log("\nDeploying SpadesFactory...");
        const Factory = await ethers.getContractFactory("SpadesFactory");
        // Fix: Pass implementation address as argument array
        const factory = await Factory.deploy(implementationAddress, {}) as any;
        await factory.waitForDeployment();
        const factoryAddress = await factory.getAddress();
        console.log(`SpadesFactory deployed at ${factoryAddress}`);

        // 3. Create a new wallet through factory (optional example)
        console.log("\nCreating new Spades wallet...");
        const [owner1, owner2, owner3] = await ethers.getSigners();
        const owners = [owner1.address, owner2.address, owner3.address];
        const requiredSignatures = 2;
        
        const createTx = await factory.createWallet(
            owners,
            requiredSignatures
        );
        
        const receipt = await createTx.wait();
        
        // Get wallet address from WalletCreated event
        const walletCreatedEvent = receipt?.logs.find(
            (log: any) => {
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
        
        // 4. Fund the wallet (optional)
        console.log("\nSending 1 ETH to wallet...");
        const fundTx = await owner1.sendTransaction({
            to: walletAddress,
            value: ethers.parseEther("1.0")
        });
        await fundTx.wait();
        console.log("Funding transaction completed");
        
        // 5. Log deployment details
        console.log("\nDeployment Summary:");
        console.log("--------------------");
        console.log(`Implementation: ${implementationAddress}`);
        console.log(`Factory: ${factoryAddress}`);
        console.log(`Example Wallet: ${walletAddress}`);
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