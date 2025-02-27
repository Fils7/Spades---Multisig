import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Spades } from "../typechain-types";
import { SchnorrSigner } from "@borislav.itskov/schnorrkel.js";

describe("Spades", function () {
    // Helper function to create a hybrid signer
    function createHybridSigner(provider: ethers.Provider) {
        const privateKey = ethers.hexlify(ethers.randomBytes(32));
        const schnorrSigner = new SchnorrSigner(privateKey);
        const ethersWallet = new ethers.Wallet(privateKey, provider);
        
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

      // Fund the hybrid signers with ETH for gas
      await deployer.sendTransaction({
          to: schnorrSigner3.address,
          value: ethers.parseEther("1.0")
      });

      // Verify funding
      const balance = await deployer.provider.getBalance(schnorrSigner3.address);
      console.log("SchnorrSigner3 balance:", ethers.formatEther(balance));

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
      
      // Parse the event data with spread operator to convert readonly array to regular array
      const walletAddress = factory.interface.parseLog({
          topics: [...walletCreatedEvent.topics],
          data: walletCreatedEvent.data
      })?.args[0];
      
      // Get wallet instance
      const wallet = SpadesImplementation.attach(walletAddress) as Spades;

      // Fund the wallet
      await deployer.sendTransaction({
          to: walletAddress,
          value: ethers.parseEther("1.0")
      });

      // Verify all balances before returning
      console.log("\nFinal balances:");
      console.log("Wallet balance:", ethers.formatEther(await deployer.provider.getBalance(walletAddress)));
      console.log("SchnorrSigner3 balance:", ethers.formatEther(await deployer.provider.getBalance(schnorrSigner3.address)));

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
    
    it("Should allow owner to submit a transaction", async function () {
      const { wallet, schnorrSigner3 } = await loadFixture(deploySpadesFixture);
      
      await wallet.connect(schnorrSigner3).submit(
          schnorrSigner3.address, 
          ethers.parseEther("0.5"), 
          "0x"
      );
      
      const tx = await wallet.getTransaction(0);
      expect(tx.targetAccount).to.equal(schnorrSigner3.address);
      expect(tx.amount).to.equal(ethers.parseEther("0.5"));
      expect(tx.confirmations).to.equal(1); // First signature from submitter
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