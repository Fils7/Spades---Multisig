// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "hardhat/console.sol";

contract MultiSigWallet {
    
          // Emits a Deposit //
    event Deposit (address sender, uint value);

        // Transaction is submited //
    event Submit (address _to, uint _value, bool executed);

        // Transaction Executed //

    event transactionExecuted (address indexed owner, uint indexed tx_Index);

         // Tracks a transaction //
    struct Transaction {
        address to;
        uint value;
        uint confirmations;
        bool executed;
    }
    
         // Stores owners addresses //
    address[] public owners;
    mapping(address => bool) public OwnersCheck;

         // Stores the required Signatures //
    uint public requiredSignatures;

        // Stores the time frame after confirmation //
    uint public timeFrame;

    Transaction[] public transactions;


        // CHecks if msg.sender is owner //
    modifier ownerOnly() {
        require(OwnersCheck[msg.sender], "Not owner");
        _;
    }

        // Checks if transaction exists //
    modifier txExists(uint _txIndex) {
        require(_txIndex < transactions.length, "Tx doesn't exist");
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
    function submit(address _to, uint _value) external ownerOnly {
        uint txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                confirmations: 0,
                executed: false
            })
        );
    }

    function signTransaction(uint _txIndex) public ownerOnly txExists(_txIndex){
        Transaction storage transaction = transactions[_txIndex];
        transaction.confirmations += 1;
    }
    

}