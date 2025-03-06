import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import { ethers } from "hardhat";
import { Spades } from "../typechain-types";
import { SchnorrMultisigProvider } from "@borislav.itskov/schnorrkel.js";
import Schnorrkel, { SchnorrSigner } from "@borislav.itskov/schnorrkel.js";
import _hashPrivateKey from "@borislav.itskov/schnorrkel.js";

describe("Spades", function () {
    // Helper function to create a hybrid signer
    function createHybridSigner(provider: ethers.Provider) {
      // Generate private key once
      const privateKey = ethers.hexlify(ethers.randomBytes(32));
      const schnorrSigner = new SchnorrSigner(privateKey);
      const ethersWallet = new ethers.Wallet(privateKey, provider);
      
      // Store the private key on the wallet for later use
      (ethersWallet as any)._privateKey = privateKey;
      
      // Add Schnorr capabilities to the ethers wallet
      Object.defineProperty(ethersWallet, 'address', {
          get: () => schnorrSigner.getSchnorrAddress()
      });
      
      return ethersWallet;
  }

    async function deploySpadesFixture() {
        // Get signers for gas payments
        const [deployer, testAccount] = await ethers.getSigners();
        
        // Create hybrid signers
        const schnorrSigner1 = createHybridSigner(deployer.provider); 
        const schnorrSigner2 = createHybridSigner(deployer.provider);
        const schnorrSigner3 = createHybridSigner(deployer.provider);

        console.log("Funding hybrid signers...");
        
        // Fund the hybrid signers with plenty of ETH for gas and wait for transactions
        const tx1 = await deployer.sendTransaction({
            to: schnorrSigner1.address,
            value: ethers.parseEther("100.0")  // 100 ETH
        });
        await tx1.wait();

        const tx2 = await deployer.sendTransaction({
            to: schnorrSigner2.address,
            value: ethers.parseEther("100.0")
        });
        await tx2.wait();

        const tx3 = await deployer.sendTransaction({
            to: schnorrSigner3.address,
            value: ethers.parseEther("100.0")
        });
        await tx3.wait();

        // Verify funding worked
        const balance1 = await deployer.provider.getBalance(schnorrSigner1.address);
        console.log("SchnorrSigner1 balance:", ethers.formatEther(balance1));
        const balance2 = await deployer.provider.getBalance(schnorrSigner2.address);
        console.log("SchnorrSigner2 balance:", ethers.formatEther(balance2));
        const balance3 = await deployer.provider.getBalance(schnorrSigner3.address);
        console.log("SchnorrSigner3 balance:", ethers.formatEther(balance3));

        console.log("SchnorrSigner1 provider:", schnorrSigner1.provider ? "connected" : "not connected");

        // Deploy implementation
        const SpadesImplementation = await ethers.getContractFactory("Spades");
        const implementation = await SpadesImplementation.deploy();
        await implementation.waitForDeployment();

        // Deploy factory
        const Factory = await ethers.getContractFactory("SpadesFactory");
        const factory = await Factory.deploy(await implementation.getAddress());
        await factory.waitForDeployment();

        // Create wallet with Schnorr addresses
        const createTx = await factory.createWallet(
            [
                deployer.address,
                schnorrSigner1.address,
                schnorrSigner2.address,
                schnorrSigner3.address
            ],
            2
        );
        
        const receipt = await createTx.wait();
        if (!receipt) throw new Error("Transaction failed");

        // Get wallet address from event
        const walletCreatedEvent = receipt.logs.find(
            (log) => log.topics[0] === factory.interface.getEvent("WalletCreated").topicHash
        );

        if (!walletCreatedEvent) throw new Error("WalletCreated event not found");
        
        const walletAddress = factory.interface.parseLog({
            topics: [...walletCreatedEvent.topics],
            data: walletCreatedEvent.data
        })?.args[0];
        
        // Get wallet instance
        const wallet = SpadesImplementation.attach(walletAddress) as Spades;

        // Fund the wallet with plenty of ETH
        await deployer.sendTransaction({
            to: walletAddress,
            value: ethers.parseEther("100.0")  // 100 ETH
        });

        // Verify wallet funding
        const walletBalance = await deployer.provider.getBalance(walletAddress);
        console.log("\nWallet balance:", ethers.formatEther(walletBalance));

        return { 
            wallet, 
            schnorrSigner1,
            schnorrSigner2,
            schnorrSigner3,
            testAccount
        };
    }

  describe("Submit", function () {
        it("Should revert if caller is not an owner", async function () {
          const { wallet, schnorrSigner3, testAccount } = await loadFixture(deploySpadesFixture);

          // Try to submit with non-owner account
          await expect(
              wallet.connect(testAccount).submit(
                  schnorrSigner3.address,
                  ethers.parseEther("0.5"), 
                  "0x"
              )
          ).to.be.revertedWith("You don't own this Spade");
        });

        it("Should revert if amount exceeds wallet balance", async function () {
          const { wallet, schnorrSigner1, schnorrSigner2 } = await loadFixture(deploySpadesFixture);
          
          // Get wallet balance
          const walletBalance = await ethers.provider.getBalance(await wallet.getAddress());
          
          // Try to submit transaction with amount greater than balance
          await expect(
              wallet.connect(schnorrSigner1).submit(
                  schnorrSigner2.address,
                  walletBalance + 1n,
                  "0x"
              )
          ).to.be.revertedWith("Insufficient balance");
      });

      it("Should successfully submit a transaction", async function () {
        const { wallet, schnorrSigner1, schnorrSigner2 } = await loadFixture(deploySpadesFixture);
        
        // Get the original signer for gas payments
        const [signer] = await ethers.getSigners();
        
        // Get initial nonce
        const initialNonce = await wallet.txNonce();
        
        // Submit transaction using the regular signer
        const amount = ethers.parseEther("0.5");
        const data = "0x";
        await expect(
            wallet.connect(signer).submit(
                schnorrSigner2.address,
                amount,
                data
            )
        ).to.emit(wallet, "Submit")
        .withArgs(schnorrSigner2.address, amount, initialNonce, data);

        // Verify transaction was stored correctly
        const tx = await wallet.getTransaction(initialNonce);
        expect(tx.targetAccount).to.equal(schnorrSigner2.address);
        expect(tx.amount).to.equal(amount);
        expect(tx.data).to.equal(data);
        expect(tx.confirmations).to.equal(1);
        expect(tx.executed).to.be.false;
        
        // Verify submitter automatically signed
        expect(await wallet.seeIfSigned(initialNonce, signer.address)).to.be.true;
        
        // Verify nonce increased
        expect(await wallet.txNonce()).to.equal(initialNonce + 1n);
    });
    
        it("Should increment transaction nonce", async function () {
          const { wallet, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
          
          await wallet.submit(schnorrSigner3.address, ethers.parseEther("0.1"), "0x");
          await wallet.submit(schnorrSigner3.address, ethers.parseEther("0.2"), "0x");
          
          const tx1 = await wallet.getTransaction(0);
          const tx2 = await wallet.getTransaction(1);
          
          expect(tx1.amount).to.equal(ethers.parseEther("0.1"));
          expect(tx2.amount).to.equal(ethers.parseEther("0.2"));
        });

        it("Should auto-sign transaction for submitter", async function () {
            const { wallet, schnorrSigner1 } = await loadFixture(deploySpadesFixture);
            const [deployer] = await ethers.getSigners();
            
            await wallet.connect(deployer).submit(schnorrSigner1.address, ethers.parseEther("0.5"), "0x");
            
            // Check if deployer auto-signed the transaction
            const isSigned = await wallet.seeIfSigned(0, deployer.address);
            expect(isSigned).to.be.true;
        });

        it("Should store correct transaction data", async function () {
          const { wallet, schnorrSigner1 } = await loadFixture(deploySpadesFixture);
          const amount = ethers.parseEther("0.5");
          const data = "0x1234";
          
          await wallet.submit(schnorrSigner1.address, amount, data);
          
          const tx = await wallet.getTransaction(0);
          expect(tx.targetAccount).to.equal(schnorrSigner1.address);
          expect(tx.amount).to.equal(amount);
          expect(tx.data).to.equal(data);
        });

        it("Should allow multiple transactions to be submitted", async function () {
          const { wallet, schnorrSigner2, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
          
          await wallet.submit(schnorrSigner2.address, ethers.parseEther("0.1"), "0x");
          await wallet.submit(schnorrSigner3.address, ethers.parseEther("0.2"), "0x");
          
          const tx1 = await wallet.getTransaction(0);
          const tx2 = await wallet.getTransaction(1);
          
          expect(tx1.targetAccount).to.equal(schnorrSigner2.address);
          expect(tx2.targetAccount).to.equal(schnorrSigner3.address);
        });

        it("Should emit Submit event with correct parameters", async function () {
          const { wallet, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
          const amount = ethers.parseEther("0.5");
          const data = "0x1234";

          await expect(wallet.submit(schnorrSigner3.address, amount, data))
            .to.emit(wallet, "Submit")
            .withArgs(schnorrSigner3.address, amount, 0, data);
        });
  });

  describe("Sign", function () {
    it("Should revert if you're not an owner", async function () {
      const { wallet, testAccount, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(schnorrSigner3.address, ethers.parseEther("0.5"), "0x");

      await expect(wallet.connect(testAccount).signTransaction(0))
        .to.be.revertedWith("You're not an owner of Spades");
    });

    it("Should sign a submitted transaction", async function () {
      const { wallet, schnorrSigner1, schnorrSigner2 } = await loadFixture(deploySpadesFixture);
      const [deployer] = await ethers.getSigners();

      // Submit a transaction
      const txNonce = 0;
      const targetAccount = schnorrSigner2.address;
      const amount = ethers.parseEther("0.5");
      const data = "0x";

      await wallet.connect(deployer).submit(targetAccount, amount, data);

      // Create commitment hash matching the contract's format
      const commitment = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
              ["address", "uint256", "uint256", "address", "uint256", "bytes"],
              [
                  await wallet.getAddress(),
                  await ethers.provider.getNetwork().then(n => n.chainId),
                  txNonce,
                  targetAccount,
                  amount,
                  data
              ]
          )
      );

      // Create Schnorr signer and get its address
      const signerOne = new SchnorrSigner((schnorrSigner1 as any)._privateKey);
      
      // Log addresses and balances for debugging
      console.log("Schnorr Address:", signerOne.getSchnorrAddress());
      console.log("Msg Sender:", schnorrSigner1.address);
      const balance = await ethers.provider.getBalance(schnorrSigner1.address);
      console.log("Signer Balance:", ethers.formatEther(balance));

      // Create individual signature
      const signature = signerOne.sign(commitment);

      // Get encoded signature for contract
      const encodedSignature = signerOne.getEcrecoverSignature(signature);

      // Sign the transaction
      await wallet.connect(schnorrSigner1).signTransaction(
          txNonce,
          encodedSignature,
          true // isSchnorr
      );

      // Verify it worked
      expect(await wallet.seeIfSigned(txNonce, schnorrSigner1.address)).to.be.true;
  });
  });

  describe("Execute", function () {
    it("Should revert if not enough signatures", async function () {
      const { wallet, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.5"), "0x");
      
      await expect(wallet.executeTransaction(0))
        .to.be.revertedWith("Not enough signatures");
    });

    it("Should execute the signed transaction", async function () {
      const { wallet, schnorrSigner2, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.5"), "0x");
      await wallet.connect(schnorrSigner2).signTransaction(0);

      await expect(wallet.executeTransaction(0))
        .to.changeEtherBalances(
          [schnorrSigner3, wallet],
          [ethers.parseEther("0.5"), ethers.parseEther("-0.5")]
        );
    });
  });

  describe("Events", function () {
    it("Should emit an event on Submit", async function () {
      const { wallet, schnorrSigner2, schnorrSigner3 } = await loadFixture(deploySpadesFixture);

      await expect(wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.5"), "0x"))
        .to.emit(wallet, "Submit")
        .withArgs(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.5"), 0, "0x");
    });

    it("Should emit an event on Sign", async function () {
      const { wallet, schnorrSigner2, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.5"), "0x");
      
      await expect(wallet.connect(schnorrSigner2).signTransaction(0))
        .to.emit(wallet, "Sign")
        .withArgs(schnorrSigner2.getSchnorrAddress(), 0);
    });

    it("Should emit an event on Execute", async function () {
      const { wallet, schnorrSigner1, schnorrSigner2, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.5"), "0x");
      await wallet.connect(schnorrSigner2).signTransaction(0);

      await expect(wallet.executeTransaction(0))
        .to.emit(wallet, "transactionExecuted")
        .withArgs(schnorrSigner1.getSchnorrAddress(), 0);  // Using owner1 as it's the default signer
    });
  });
});