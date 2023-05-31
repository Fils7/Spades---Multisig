// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "hardhat/console.sol";

contract MultiSigWallet {
    
// Emits a Deposit 
    event Deposit (address sender, uint _value);

// Transaction is submited 
    event Submit (address _to, uint _value, uint txNonce);

 // Signs a Transaction
    event Sign (address indexed _owner, uint _txNonce);

// Transaction Executed 
    event transactionExecuted (address indexed _owner, uint _txNonce);

// Tracks a transaction 
    struct Transaction {
        address to;
        uint value;
        uint confirmations;
        address signature;
    }

    Transaction public transaction;
    
// Stores owners addresses 
    address[] private owners;
    mapping(address => bool) public OwnersCheck;

// Stores the required Signatures
    uint public requiredSignatures;

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
    constructor(address[] memory _owners, uint _signaturesRequired) {
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
    function submit(address _to, uint _value) external ownerOnly {

        transaction = Transaction({
            to: _to,
            value: _value,
            confirmations: 1,
            signature: msg.sender
        });
    
        txMap[txNonce];
        txNonce;

    }
    
    function signTransaction(uint _txIndex) public ownerOnly txExists(_txIndex){
        _txIndex = txNonce;
        
        Transaction storage transaction = txMap[txNonce];
        // TODO: Check if the same owner already signed!!!
        transaction.confirmations += 1;
    }
    
        // TODO: Execute function
   function executeTransaction(uint _txIndex) public ownerOnly txExists(_txIndex) {
        Transaction storage transaction = txMap[txNonce];
   }

}