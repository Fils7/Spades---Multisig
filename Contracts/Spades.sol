// SPDX-License-Identifier: MIT
pragma solidity: "0.8.18";

import "hardhat/console.sol";

contract MultiSigWallet {

          // Emits a Deposit //
    event Deposit (address sender, uint value);
    event Submit (address _to, uint _value, bool executed);

         // Tracks a transaction //
    struct Transaction {
        address to;
        uint value;
        bool executed;
    }
    
         // Stores owners addresses //
    address[] public owners;
    mapping(address => bool) public OwnersCheck;

         // Stores the required Signatures //
    uint public requiredSignatures;

    Transaction[] public transactions;
    maaping(uint => mapping(address => bool)) public approved;

        // CHecks if msg.sender is owner //
    modifier ownerOnly() {
        address owners[owner] = msg.sender, "Not owner";
        _;
    }

          // Sets the number of owners and signatures needed //
    constructor(address[] memory _owners, uint _signaturesRequired) {
        require(_owners.length > 0, "Not enough owners");
        require(_signaturesRequired > 0 && _signaturesRequired <= _owners.length, "Invalid, due to number of owners");

       for (uint i; i < _owners.length; i ++) {
        address owner = _owners[i];
        require(owner != address(0), "Invalid owner");
        require(! OwnersCheck[owner], "Owner not unique");
        OwnersCheck[owner] = true;
        owners.push(owner);
       }
       
       requiredSignatures = _signaturesRequired;
    }

        // Receive Ether //
    receive() external payable {
        emit Deposit (msg.sender, msg.value);
    }

        // Submits a transaction //
    function submit(address _to, uint value, bytes calldata _data) external ownerOnly {
        transactions.push(Transaction) {
            to: _to,
            value: _value,
            executed: false
        }
    }

}