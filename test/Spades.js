const {
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { Contract } = require("hardhat/internal/hardhat-network/stack-traces/model");

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
      await wallet.submit(owner3.address, 100);
    });

    it("Should revert if owner is not msg sender", async function () {
      const { wallet, owner3, defaultAccount } = await loadFixture(deploySpadesFixture);

      await expect(wallet.connect(defaultAccount).submit(owner3.address, 100)).to.be.revertedWith(
        "Not owner"
      );

  describe("Sign", async function () {

    it("Should be only owner to sign", async function () {
      const { wallet, defaultAccount, owner3 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, 100);

      await expect(wallet.connect(defaultAccount).signTransaction(0)).to.be.revertedWith(
        "Not owner"
      );
        
      await expect(wallet.signTransaction(0));

  describe("Execute", async function () {
    it("Should execute the signed transaction", async function () {
      const { wallet, owner3, owner2 } = await loadFixture(deploySpadesFixture);
      await wallet.submit(owner3.address, 100);

      await wallet.connect(owner2).signTransaction(0);
      await wallet.connect(owner3).signTransaction(0);

      await expect(wallet.executeTransaction(0)).to.changeEtherBalances(
        [owner3, wallet],
        [100, -100]
      );
    })
  })
    });
  })
  
    });
  });
});

