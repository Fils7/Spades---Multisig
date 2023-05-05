// SPDX-License-Identifier: MIT
pragma solidity: "0.8.18";

contract MultiSigWallet {

          // Emits a Deposit //
    event Deposit (address sender, uint value);

         // Tracks a transaction //
    struct Transaction {
        address to;
        uint value;
        bool executed;
    }
    
         // Stores owners addresses //
    address[] public owners;
    mapping(address => bool) public isOwner;

         // Stores the required Signatures //
    uint public requiredSignatures;

          // Sets the number of owners and signatures needed //
    constructor(address[] memory _owners, uint _required) {
        require(_owners.length > 0, "Not enough owners");
        require(_required > 0 && _required <= _owners.length, "Invalid, due to number of owners");
    }

        // Receive Ether //

    receive() external payable {
        emit Deposit (msg.sender, msg.value);
    }

}