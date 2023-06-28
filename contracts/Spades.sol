// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "hardhat/console.sol";

contract Spades {
    
// Emits a Deposit 
    event Deposit (address sender, uint _value);

// Transaction is submited 
    event Submit (address _to, uint _amount);

 // Signs a Transaction
    event Sign (address _owner, uint _txNonce);

// Transaction Executed 
    event transactionExecuted (address sender, uint _txNonce);

// Tracks a transaction 
    struct Transaction {
        address to;
        uint amount;
        uint confirmations;
        address signature;
    }

    Transaction public transaction;
    
// Stores owners addresses 
    address[] private owners;
    mapping(address => bool) public OwnersCheck;

// Stores the required Signatures
    uint public requiredSignatures;
    mapping (uint => mapping (address => bool)) whoSigned;

 // Stores tx Index 
    mapping (uint => Transaction) public txMap;
    uint txNonce;

// Checks if msg.sender is owner 
    modifier ownerOnly() {
        require(OwnersCheck[msg.sender], "Not owner");
        _;
    }

// Checks if transaction exists 
    modifier txExists(uint _txIndex) {
        require(_txIndex <= txNonce, "Tx doesn't exist");
        _;
    }

// Sets the number of owners and signatures needed 
    constructor(address[] memory _owners, uint _signaturesRequired) payable {
        require(_owners.length > 0, "Not enough owners");
        require(_signaturesRequired > 0 && _signaturesRequired <= _owners.length, "Invalid, due to number of owners");

       for (uint i; i < _owners.length; i ++) {
        address owner = _owners[i];
        require(! OwnersCheck[owner], "Owner not unique");
        OwnersCheck[owner] = true;
        owners.push(owner);
       }

       requiredSignatures = _signaturesRequired;
    }
    
// Receive Ether 
    receive() external payable {
        emit Deposit (msg.sender, msg.value);
    }

// Submits a transaction 
    function submit(address _to, uint _amount) external payable ownerOnly {

        transaction = Transaction({
            to: _to,
            amount: _amount,
            confirmations: 1,
            signature: msg.sender
        });
    
        txMap[txNonce] = transaction;
        txNonce++;
        whoSigned[txNonce][msg.sender] = true;
        emit Submit(msg.sender, _amount);

    }
    
    function signTransaction(uint txIndex) public ownerOnly txExists(txIndex){
        Transaction storage transaction = txMap[txIndex];
        require(!whoSigned[txNonce][msg.sender]);
        transaction.confirmations += 1;
        emit Sign (msg.sender, txIndex);
    }
    
   function executeTransaction(uint txIndex) public txExists(txIndex) {
        Transaction storage transaction = txMap[txIndex];
        require(transaction.confirmations >= requiredSignatures, "Not enough signatures");
        (bool success, ) = transaction.to.call{value: transaction.amount} ("");
        require(success, "Tx failed to execute");
        emit transactionExecuted (msg.sender, txNonce);
   }
}