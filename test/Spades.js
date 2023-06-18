const {
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Spades", function () {
    it("Should work!", async function () {
      // Contracts are deployed using the first signer/account by default.
      const [owner1, owner2, owner3] = await ethers.getSigners();

      // Deploy contract.
      const Wallet = await ethers.getContractFactory("Spades");
      const wallet = await Wallet.deploy([owner1.address, owner2.address, owner3.address], 2, { value: 100 });

      // Submit transaction.
      await wallet.submit(owner3.address, 100);

      // Sign transaction.
      await wallet.connect(owner2).signTransaction(0);

      // Execute transaction.
      await expect(wallet.executeTransaction(0)).to.changeEtherBalances(
        [owner3, wallet],
        [100, -100]
      );
    });
});
