import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Spades, SpadesFactory } from "../typechain-types";

describe("Spades", function () {
  async function deploySpadesFixture() {
    // Get signers
    const [owner1, owner2, owner3, testAccount] = await ethers.getSigners();

    // Deploy factory
    const SpadesFactory = await ethers.getContractFactory("SpadesFactory");
    const factory = await SpadesFactory.deploy();

    // Deploy wallet through factory
    const createTx = await factory.createWallet(
      [owner1.address, owner2.address, owner3.address],
      2
    );
    
    const receipt = await createTx.wait();
    if (!receipt) throw new Error("Transaction failed");

    // Get wallet address from event
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

    if (!walletCreatedEvent) throw new Error("WalletCreated event not found");

    const parsedLog = factory.interface.parseLog({
      topics: walletCreatedEvent.topics as string[],
      data: walletCreatedEvent.data
    });

    const walletAddress = parsedLog?.args[0];
    
    // Get wallet instance - Updated this part
    const SpadesContract = await ethers.getContractFactory("Spades");
    const wallet = (await SpadesContract.attach(walletAddress)) as Spades;

    // Fund the wallet
    await owner1.sendTransaction({
      to: walletAddress,
      value: ethers.parseEther("1.0")
    });

    return { wallet, owner1, owner2, owner3, testAccount };
  }

  describe.only("Submit", function () {
    it("Should revert if caller is not an owner", async function () {
      const { wallet, owner3, testAccount } = await loadFixture(deploySpadesFixture);

      await expect(
        wallet.connect(testAccount).submit(owner3.address, ethers.parseEther("0.5"), "0x")
      ).to.be.revertedWith("You're not an owner of Spades");
    });

    it("Should revert if amount exceeds wallet balance", async function () {
      const { wallet, owner3 } = await loadFixture(deploySpadesFixture);
      const walletBalance = await ethers.provider.getBalance(await wallet.getAddress());
      
      await expect(
        wallet.submit(owner3.address, walletBalance + 1n, "0x")
      ).to.be.revertedWith("Insufficient balance");
    });
    
    it("Should allow owner to submit a transaction", async function () {
      const { wallet, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");
      
      const tx = await wallet.getTransaction(0);
      expect(tx.targetAccount).to.equal(owner3.address);
      expect(tx.amount).to.equal(ethers.parseEther("0.5"));
      expect(tx.confirmations).to.equal(1); // First signature from submitter
    });

    it("Should increment transaction nonce", async function () {
      const { wallet, owner3 } = await loadFixture(deploySpadesFixture);
      
      await wallet.submit(owner3.address, ethers.parseEther("0.1"), "0x");
      await wallet.submit(owner3.address, ethers.parseEther("0.2"), "0x");
      
      const tx1 = await wallet.getTransaction(0);
      const tx2 = await wallet.getTransaction(1);
      
      expect(tx1.amount).to.equal(ethers.parseEther("0.1"));
      expect(tx2.amount).to.equal(ethers.parseEther("0.2"));
    });

    it("Should auto-sign transaction for submitter", async function () {
      const { wallet, owner1, owner3 } = await loadFixture(deploySpadesFixture);
      
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");
      
      const isSigned = await wallet.seeIfSigned(0, owner1.address);
      expect(isSigned).to.be.true;
    });

    it("Should store correct transaction data", async function () {
      const { wallet, owner3 } = await loadFixture(deploySpadesFixture);
      const amount = ethers.parseEther("0.5");
      const data = "0x1234";
      
      await wallet.submit(owner3.address, amount, data);
      
      const tx = await wallet.getTransaction(0);
      expect(tx.targetAccount).to.equal(owner3.address);
      expect(tx.amount).to.equal(amount);
      expect(tx.data).to.equal(data);
    });

    it("Should allow multiple transactions to be submitted", async function () {
      const { wallet, owner2, owner3 } = await loadFixture(deploySpadesFixture);
      
      await wallet.submit(owner2.address, ethers.parseEther("0.1"), "0x");
      await wallet.submit(owner3.address, ethers.parseEther("0.2"), "0x");
      
      const tx1 = await wallet.getTransaction(0);
      const tx2 = await wallet.getTransaction(1);
      
      expect(tx1.targetAccount).to.equal(owner2.address);
      expect(tx2.targetAccount).to.equal(owner3.address);
    });

    it("Should emit Submit event with correct parameters", async function () {
      const { wallet, owner3 } = await loadFixture(deploySpadesFixture);
      const amount = ethers.parseEther("0.5");
      const data = "0x1234";

      await expect(wallet.submit(owner3.address, amount, data))
        .to.emit(wallet, "Submit")
        .withArgs(owner3.address, amount, 0, data);
    });
  });

  describe("Sign", function () {
    it("Should revert if you're not an owner", async function () {
      const { wallet, testAccount, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");

      await expect(wallet.connect(testAccount).signTransaction(0))
        .to.be.revertedWith("You're not an owner of Spades");
    });

    it("Should allow owner to sign", async function () {
      const { wallet, owner1, owner2, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");
      await wallet.connect(owner2).signTransaction(0);

      expect(await wallet.seeIfSigned(0, owner2.address)).to.be.true;
    });
  });

  describe("Execute", function () {
    it("Should revert if not enough signatures", async function () {
      const { wallet, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");
      
      await expect(wallet.executeTransaction(0))
        .to.be.revertedWith("Not enough signatures");
    });

    it("Should execute the signed transaction", async function () {
      const { wallet, owner2, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");
      await wallet.connect(owner2).signTransaction(0);

      await expect(wallet.executeTransaction(0))
        .to.changeEtherBalances(
          [owner3, wallet],
          [ethers.parseEther("0.5"), ethers.parseEther("-0.5")]
        );
    });
  });

  describe("Events", function () {
    it("Should emit an event on Submit", async function () {
      const { wallet, owner1, owner3 } = await loadFixture(deploySpadesFixture);

      await expect(wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x"))
        .to.emit(wallet, "Submit")
        .withArgs(owner3.address, ethers.parseEther("0.5"), 0, "0x");
    });

    it("Should emit an event on Sign", async function () {
      const { wallet, owner2, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");
      
      await expect(wallet.connect(owner2).signTransaction(0))
        .to.emit(wallet, "Sign")
        .withArgs(owner2.address, 0);
    });

    it("Should emit an event on Execute", async function () {
      const { wallet, owner1, owner2, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, ethers.parseEther("0.5"), "0x");
      await wallet.connect(owner2).signTransaction(0);

      await expect(wallet.executeTransaction(0))
        .to.emit(wallet, "transactionExecuted")
        .withArgs(owner1.address, 0);  // Using owner1 as it's the default signer
    });
  });
});