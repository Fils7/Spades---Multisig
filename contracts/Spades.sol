// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "hardhat/console.sol";

/**
 * @title   DAOsigs - A DAO / CrowdFunding contract integrated with a multi-signature wallet when deployed
 * @author  
 * @dev     Supports ERC-20 interface.
 * @notice  This is a basic crowd funding / DAO contract with a multi-signature 
 * feature. This requires the need for owners to sign function calls to submit an action. 
*/

contract Spades {

        // Emits a Deposit 
    event Deposit (address sender, uint _value, uint _balance);

        // Transaction is submited 
    event Submit (address _to, uint _amount, uint _txNonce, bytes data);

        // Signs a Transaction
    event Sign (address _owner, uint _txNonce);

        // Transaction Executed 
    event transactionExecuted (address sender, uint _txNonce);

        // Transaction was revoked
    event revoked (address sender, uint _txNonce);

    ///@notice This is what's inside a transaction
        ///@dev Returns data when interacting with other contracts

    struct Transaction {
        address to;
        uint amount;
        uint confirmations;
        address signature;
        bytes data;
        bool executed;
    }

    Transaction public transaction;

        // Stores owners addresses 
    address[] private owners;
    mapping(address => bool) public OwnersCheck;

        // Stores the required Signatures passed in the constructor()
    uint public requiredSignatures;

        // Goes from an uint (TxIndex) to the address (Owner) that signed a tx
        // equals true if that owner already signed;
    mapping (uint => mapping (address => bool)) whoSigned;

    ///@dev Stores tx Index;
     /// Starts at index 0;

    mapping (uint => Transaction) public txMap;
    uint txNonce;

        // Checks if msg.sender is owner 
    modifier ownerOnly() {
        require(OwnersCheck[msg.sender], "You're not an owner of Spades");
        _;
    }

        // Checks if transaction exists 
    modifier txExists(uint _txIndex) {
        require(_txIndex < txNonce, "Tx doesn't exist");
        _;
    }

        // Checks if the tx was not executed
    modifier notExecuted(uint _txIndex) {
        require(txMap[_txIndex].executed == false, "Transaction was already executed");
        _;
    }

        // Sets the number of owners and signatures needed 
    constructor(address[] memory _owners, uint _signaturesRequired) payable {
        require(_owners.length > 0, "Not enough owners");
        require(_signaturesRequired > 0 && _signaturesRequired <= _owners.length, "Signatures required must be greater than 0 and less than the owners defined ");

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
        emit Deposit (msg.sender, msg.value, address(this).balance);
    }

        // Submits a transaction 
    function submit(address payable _to, uint _amount, bytes memory _data) public ownerOnly {

        transaction = Transaction({
            to: _to,
            amount: _amount,
            confirmations: 1,
            signature: msg.sender,
            data: _data,
            executed: false
        });

    ///@dev After submiting the msg.sender is a signed owner;
    // txNonce incresases by one;

        txMap[txNonce] = transaction;
        whoSigned[txNonce][msg.sender] = true;
        txNonce ++;

        emit Submit(msg.sender, _amount, txNonce, _data);

    }
    
        // Returns a transaction when given the tx_index
    function getTransaction(uint txIndex) public view returns (address to, uint amount, uint confirmations, address signature) {
    
        Transaction memory transaction = txMap[txIndex];

        return (
            transaction.to,
            transaction.amount,
            transaction.confirmations,
            transaction.signature
        );
    }

        // Can check who already signed the transaction
    function seeIfSigned(uint txIndex, address _owner) public view returns (bool) {
        return whoSigned[txIndex][_owner];
    }

        // Signs a transaction that was submited from another owner
    function signTransaction(uint txIndex) public ownerOnly txExists(txIndex){
        Transaction memory transaction = txMap[txIndex];
        require(whoSigned[txIndex][msg.sender] == false);
        transaction.confirmations += 1;
        whoSigned[txIndex][msg.sender] = true;
        
        emit Sign (msg.sender, txIndex);
    }

        // Revokes a signature that was already made
    function revokeConfirmation(uint txIndex) public txExists(txIndex) notExecuted(txIndex) ownerOnly {
        Transaction memory transaction = txMap[txIndex];

        require(whoSigned[txIndex][msg.sender] == true, "You didn't sign this transaction");
        transaction.confirmations - 1;
        whoSigned[txIndex][msg.sender] = false;

        emit revoked (msg.sender, txIndex);

    }
    
       /// @notice Executes the transaction after reaching the required signatures;

   function executeTransaction(uint txIndex) public txExists(txIndex) {
        Transaction memory transaction = txMap[txIndex];
        require(transaction.confirmations >= requiredSignatures, "Not enough signatures");
        (bool success, ) = transaction.to.call{value: transaction.amount}(
            transaction.data);
        require(success, "Tx failed to execute");
        txMap[txIndex].executed = true;

        emit transactionExecuted (msg.sender, txIndex);
   }

        // View contract Spades balance 
   function spadesBalance() public view ownerOnly returns (uint256) {
    return address(this).balance;
   }

}