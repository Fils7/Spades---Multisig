const {
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { Contract } = require("hardhat/internal/hardhat-network/stack-traces/model");
const { ethers } = require("hardhat");

describe("Spades", function () {
  async function deploySpadesFixture() {
      // Contracts are deployed using the first signer/account by default.
    const [owner1, owner2, owner3, defaultAccount] = await ethers.getSigners();

      // Deploy contract.
    const Wallet = await ethers.getContractFactory("Spades");
    const wallet = await Wallet.deploy([owner1.address, owner2.address, owner3.address], 2, { value: 100 });
  

    return { wallet, owner1, owner2, owner3, defaultAccount };
  }

  describe("Submit", function () {

    it("Should submit a transaction to be signed", async function () {
      const { wallet, owner3} = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, 50);
    });

    it("Should revert if owner is not msg sender", async function () {
      const { wallet, owner3, defaultAccount } = await loadFixture(deploySpadesFixture);

      await expect(wallet.connect(defaultAccount).submit(owner3.address, 50)).to.be.revertedWith(
        "Not owner"
      );

  describe("Sign", async function () {
    it("Should revert if not the owner", async function () {
      const { wallet, defaultAccount, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, 50);

      await expect(wallet.connect(defaultAccount).signTransaction(0)).to.be.revertedWith(
        "Not owner"
      );
      });

    it("Should be only owner to sign", async function (){
      const { wallet } = await loadFixture(deploySpadesFixture);
      expect(wallet.signTransaction(0)
      );


  describe("Execute", async function () {

    it("Should revert if not enough signatures", async function () {
      const { wallet } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, 50);
      
      await expect(wallet.executeTransaction(0)).to.be.revertedWith(
        "Not enough signatures"
      );
    })


    it("Should execute the signed transaction", async function () {
      const { wallet, owner3, owner2 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, 50);

      await wallet.connect(owner2).signTransaction(0);
      await wallet.connect(owner3).signTransaction(0);

      await expect(wallet.executeTransaction(0)).to.changeEtherBalances(
        [owner3, wallet],
        [50, -50]
      );
    })
  })
    });
  })

  // Emiting an Event \ To be fixed
  describe("Events", async function () {

    it("Should emit an event on Submit", async function () {
      const { wallet, owner1, owner3} = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, 50);

      await expect (wallet.submit(owner3.address, 50))
        .to.emit(wallet, "Submit")
        .withArgs(owner1.address, 50);
    });

    it("Should emit an event on Sign tx", async function () {
      const { wallet, owner3, owner2 } = await loadFixture(deploySpadesFixture);

      const secondOwnerAddress = await ethers.getSigner(owner2.address)

      await wallet.submit(owner3.address, 50);
      await wallet.connect(secondOwnerAddress).signTransaction(0);

      await expect (wallet.connect(secondOwnerAddress).signTransaction(0))
      .to.emit(wallet, "Sign")
      .withArgs(owner2.address, 0);
    });

    it("Should emit an event on Execute", async function () {
      const { wallet, owner3, owner2, defaultAccount } = await loadFixture(deploySpadesFixture);

      const secondOwnerAddress = await ethers.getSigner(owner2.address)

      await wallet.submit(owner3.address, 50);
      await wallet.connect(secondOwnerAddress).signTransaction(0);
      await wallet.connect(defaultAccount).executeTransaction(0);

      await expect (wallet.connect(defaultAccount).executeTransaction(0))
      .to.emit(wallet, "transactionExecuted")
      .withArgs(defaultAccount.address, 1);
    })
  });
  
    });
  });
});