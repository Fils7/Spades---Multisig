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
        console.log("SchnorrSigner3 address:", schnorrSigner3.address);

        // Fund the hybrid signers with plenty of ETH for gas
        await deployer.sendTransaction({
            to: schnorrSigner1.address,
            value: ethers.parseEther("100.0")  // 100 ETH
        });
        await deployer.sendTransaction({
            to: schnorrSigner2.address,
            value: ethers.parseEther("100.0")
        });
        await deployer.sendTransaction({
            to: schnorrSigner3.address,
            value: ethers.parseEther("100.0")
        });

        // Verify funding
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

describe.only("Submit", function () {
      it("Should revert if caller is not an owner", async function () {
        const { wallet, schnorrSigner3, testAccount } = await loadFixture(deploySpadesFixture);

        // Try to submit with non-owner account
        await expect(
            wallet.connect(testAccount).submit(
                schnorrSigner3.address,  // Use .address instead of .getSchnorrAddress()
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

    it('should generate multi signature', () => {
      const schnorrkelOne = new Schnorrkel();
      const schnorrkelTwo = new Schnorrkel();
  
      // Generate random private keys as hex strings
      const privateKey1 = ethers.hexlify(ethers.randomBytes(32));
      const privateKey2 = ethers.hexlify(ethers.randomBytes(32));
  
      // Create SchnorrSigners with the private keys
      const signer1 = new SchnorrSigner(privateKey1);
      const signer2 = new SchnorrSigner(privateKey2);
  
      const publicNoncesOne = schnorrkelOne.generatePublicNonces();
      const publicNoncesTwo = schnorrkelTwo.generatePublicNonces();
  
      const publicNonces = [publicNoncesOne, publicNoncesTwo];
      const publicKeys = [signer1.publicKey, signer2.publicKey];
  
      const msg = 'test message';
      const signature = schnorrkelOne.multiSigSign(
          signer1.privateKey,
          ethers.hashMessage(msg),
          publicKeys,
          publicNonces
      );
  
      expect(signature).toBeDefined();
      expect(signature.publicNonce.buffer).toHaveLength(33);
      expect(signature.signature.buffer).toHaveLength(32);
      expect(signature.challenge.buffer).toHaveLength(32);
  });

    it("Owners can submit transactions", async function () {
      const { wallet, schnorrSigner1, schnorrSigner2 } = await loadFixture(deploySpadesFixture);
      
      // Get a regular signer for gas fees
      const [signer] = await ethers.getSigners();
      
      // Create SchnorrSigners using the private keys
      const schnorrSigner1Instance = new SchnorrSigner((schnorrSigner1 as any)._privateKey);
      const schnorrSigner2Instance = new SchnorrSigner((schnorrSigner2 as any)._privateKey);
      
      // Create multisig provider that will generate the virtual address
      const multisigProvider = new SchnorrMultisigProvider([
          schnorrSigner1Instance,
          schnorrSigner2Instance
      ]);

      // Get initial txNonce
      const initialNonce = await wallet.txNonce();
      
      // Create message hash for the transaction
      const messageHash = ethers.solidityPackedKeccak256(
          ["address", "uint256", "bytes", "uint256"],
          [schnorrSigner2.address, ethers.parseEther("0.5"), "0x", initialNonce]
      );

      // Get signatures from both signers
      const signature1 = schnorrSigner1Instance.sign(messageHash);
      const signature2 = schnorrSigner2Instance.sign(messageHash);

      // Get the combined signature that represents the virtual address
      const combinedSignature = multisigProvider.getEcrecoverSignature([
          signature1,
          signature2
      ]);

      // Get the virtual address that represents both signers
      const virtualAddress = multisigProvider.getAddress();
      console.log("Virtual multisig address:", virtualAddress);

      // Submit using regular signer for gas, with the combined signature
      await expect(
          wallet.connect(signer).submit(
              schnorrSigner2.address,
              ethers.parseEther("0.5"),
              "0x",
              combinedSignature  // This represents both signatures combined
          )
      ).to.emit(wallet, "Submit")
        .withArgs(
            schnorrSigner2.address,
            ethers.parseEther("0.5"),
            initialNonce,
            "0x"
        );
      
      // Verify transaction was recorded
      const tx = await wallet.txMap(initialNonce);
      expect(tx.targetAccount).to.equal(schnorrSigner2.address);
      expect(tx.amount).to.equal(ethers.parseEther("0.5"));
      expect(tx.confirmations).to.equal(1); // One virtual signer that represents both
  });

      it("Should increment transaction nonce", async function () {
        const { wallet, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
        
        await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.1"), "0x");
        await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.2"), "0x");
        
        const tx1 = await wallet.getTransaction(0);
        const tx2 = await wallet.getTransaction(1);
        
        expect(tx1.amount).to.equal(ethers.parseEther("0.1"));
        expect(tx2.amount).to.equal(ethers.parseEther("0.2"));
      });

      it("Should auto-sign transaction for submitter", async function () {
        const { wallet, schnorrSigner1 } = await loadFixture(deploySpadesFixture);
        
        await wallet.submit(schnorrSigner1.getSchnorrAddress(), ethers.parseEther("0.5"), "0x");
        
        const isSigned = await wallet.seeIfSigned(0, schnorrSigner1.getSchnorrAddress());
        expect(isSigned).to.be.true;
      });

      it("Should store correct transaction data", async function () {
        const { wallet, schnorrSigner1 } = await loadFixture(deploySpadesFixture);
        const amount = ethers.parseEther("0.5");
        const data = "0x1234";
        
        await wallet.submit(schnorrSigner1.getSchnorrAddress(), amount, data);
        
        const tx = await wallet.getTransaction(0);
        expect(tx.targetAccount).to.equal(schnorrSigner1.getSchnorrAddress());
        expect(tx.amount).to.equal(amount);
        expect(tx.data).to.equal(data);
      });

      it("Should allow multiple transactions to be submitted", async function () {
        const { wallet, schnorrSigner2, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
        
        await wallet.submit(schnorrSigner2.getSchnorrAddress(), ethers.parseEther("0.1"), "0x");
        await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.2"), "0x");
        
        const tx1 = await wallet.getTransaction(0);
        const tx2 = await wallet.getTransaction(1);
        
        expect(tx1.targetAccount).to.equal(schnorrSigner2.getSchnorrAddress());
        expect(tx2.targetAccount).to.equal(schnorrSigner3.getSchnorrAddress());
      });

      it("Should emit Submit event with correct parameters", async function () {
        const { wallet, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
        const amount = ethers.parseEther("0.5");
        const data = "0x1234";

        await expect(wallet.submit(schnorrSigner3.getSchnorrAddress(), amount, data))
          .to.emit(wallet, "Submit")
          .withArgs(schnorrSigner3.getSchnorrAddress(), amount, 0, data);
      });
  });

  describe("Sign", function () {
    it("Should revert if you're not an owner", async function () {
      const { wallet, testAccount, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(schnorrSigner3.getSchnorrAddress(), ethers.parseEther("0.5"), "0x");

      await expect(wallet.connect(testAccount).signTransaction(0))
        .to.be.revertedWith("You're not an owner of Spades");
    });

    it("Should allow owner to sign", async function () {
      const { wallet, schnorrSigner1, schnorrSigner2 } = await loadFixture(deploySpadesFixture);

      // First submit the transaction
      const [signer] = await ethers.getSigners(); // Regular signer for gas fees
      const txNonce = 0;
      const targetAccount = schnorrSigner2.getSchnorrAddress();
      const amount = ethers.parseEther("0.5");
      const data = "0x";

      // Submit transaction
      await wallet.connect(signer).submit(targetAccount, amount, data);

      // Create message hash for signing
      const messageHash = ethers.solidityPackedKeccak256(
          ["address", "uint256", "bytes", "uint256"],
          [targetAccount, amount, data, txNonce]
      );

      // Get Schnorr signature
      const signature = schnorrSigner2.sign(messageHash);

      // Convert signature and public nonce to BytesLike format
      const signatureBytes = ethers.hexlify(signature.signature.buffer);
      const publicNonceBytes = ethers.hexlify(signature.publicNonce.buffer);

      // Submit the Schnorr signature
      await wallet.connect(signer).signTransaction(
          txNonce,
          signatureBytes,    // Convert to bytes
          true,             // isSchnorr flag
          publicNonceBytes  // Convert to bytes
      );
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