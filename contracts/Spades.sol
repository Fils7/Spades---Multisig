// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "hardhat/console.sol";

/**
 * @title  Spades Multisig
 * @author  Filipe Rey
 *
 * @notice  This is a multisignature wallet that permits several owners
 *  to submit and sign on transactions, for an extra layer of security.
 * Who ever is an owner can revoke confirmations and set withdraw dailyWithdrawlimits for 
 * the rest of the owners, if they agree.
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

    ///@notice This struct stores account specific informations.

    struct Account {

        address proposer;
        uint lastWithdrawalTimestamp;
        uint approvals;
        uint dailyWithdrawlimit;
        address to;
    }
    Account public account;


    ///@notice This is whauintt's inside a transaction.
        ///@dev Returns data when interacting with other contracts.

    struct Transaction {

        address to;
        uint amount;
        uint confirmations;
        address signature;
        bytes data;
        bool executed;
    }

    Transaction public transaction;

        // Stores owners addresses.
    address[] public owners;
    mapping(address => bool) public OwnersCheck;

        // Stores the required Signatures passed in the constructor().
    uint public requiredSignatures;

        // Goes from an uint Request(TxIndex) to the address (Owner) that signed a transaction
        // equals true if that owner already signed.
    mapping (uint => mapping (address => bool)) whoSignedTx;

        // Goes from an uint (TxIndex) to the address (Owner) that signed the account settings pending
        // equals true if that owner already signed.
    mapping (uint => mapping (address => bool)) whoSignedSettings;

    ///@dev Stores tx index, starts at 0;
    mapping (uint => Transaction) public txMap;
    uint txNonce;

    ///@dev Stores account settings request.
    mapping (uint => Account) public submitedSettings;
    uint accountIndex;


    ///@dev Conects the account to an address
    mapping (address => Account) public accountInfo;


        // Checks if msg.sender is owner.
    modifier ownerOnly() {
        require(OwnersCheck[msg.sender], "You're not an owner of Spades");
        _;
    }

        // Checks if transaction exists. 
    modifier txExists(uint _txIndex) {
        require(_txIndex < txNonce, "Tx doesn't exist");
        _;
    }

        // Checks if the tx was not executed.
    modifier notExecuted(uint _txIndex) {
        require(txMap[_txIndex].executed == false, "Transaction was already executed");
        _;
    }

        // Sets the number of owners and signatures needed. 
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
    
        // Contract can receive Ether. 
    receive() external payable {
        emit Deposit (msg.sender, msg.value, address(this).balance);
    }

        // Submits a transaction to be signed by required owners. 
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
        whoSignedTx[txNonce][msg.sender] = true;
        txNonce ++;

        emit Submit(msg.sender, _amount, txNonce, _data);

    }
    
        // Returns a transaction when given the tx_index.
    function getTransaction(uint txIndex) public view returns (address to, uint amount, uint confirmations, address signature, bool executed) {
    
        Transaction storage transaction = txMap[txIndex];

        return (
            transaction.to,
            transaction.amount,
            transaction.confirmations,
            transaction.signature,
            transaction.executed
        );
    }

        // Can check who already signed the transaction.
    function seeIfSigned(uint txIndex, address _owner) public view returns (bool) {
        return whoSignedTx[txIndex][_owner];
    }

        // Signs a transaction that was submited from another owner.
    function signTransaction(uint txIndex) public ownerOnly txExists(txIndex){
        Transaction storage transaction = txMap[txIndex];
        require(whoSignedTx[txIndex][msg.sender] == false);
        transaction.confirmations += 1;
        whoSignedTx[txIndex][msg.sender] = true;
        
        emit Sign (msg.sender, txIndex);
    }

        // Revokes a signature that was already made.
    function revokeConfirmation(uint txIndex) public txExists(txIndex) notExecuted(txIndex) ownerOnly {
        Transaction storage transaction = txMap[txIndex];

        require(whoSignedTx[txIndex][msg.sender] == true, "You didn't sign this transaction");
        transaction.confirmations - 1;
        whoSignedTx[txIndex][msg.sender] = false;

        emit revoked (msg.sender, txIndex);

    }
    
       /// @notice Executes the transaction passed in submit function after reaching the required signatures;

   function executeTransaction(uint txIndex) public txExists(txIndex) {

        Transaction storage transaction = txMap[txIndex];
        require(transaction.confirmations >= requiredSignatures, "Not enough signatures");
        (bool success, ) = transaction.to.call{value: transaction.amount}(
            transaction.data);
        require(success, "Tx failed to execute");
        txMap[txIndex].executed = true;
        transaction.executed = true;

        emit transactionExecuted (msg.sender, txIndex);
   }
        ///@notice Will submit an account limit to be signed by the other owners.
        ///@dev The last withdraw timestamp approved must be fetched for the address submited.

   function submitAccountLimit(address _account, uint _dailyWithdrawlimit) public ownerOnly {
        require(_dailyWithdrawlimit >= 0, "Invalid dailyWithdrawlimit");
        require(OwnersCheck[_account] = true, "Address does not match with any of the owners.");
        uint accountTimestamp = accountInfo[_account].lastWithdrawalTimestamp;

        account = Account({

            proposer: msg.sender,
            lastWithdrawalTimestamp: accountTimestamp,
            approvals: 1,
            dailyWithdrawlimit: _dailyWithdrawlimit,
            to: _account
        });

        submitedSettings[accountIndex] = account;
        whoSignedSettings[accountIndex][msg.sender] = true;
        accountIndex ++;
        
   }
    ///@dev This signs the request for the setting, after reaching
    // the required signatures will execute by itself.

   function signAccountLimit(uint _proposedSettings) public ownerOnly {

        Account storage account = submitedSettings[_proposedSettings];
        require(whoSignedSettings[_proposedSettings][msg.sender] == false);
        account.approvals += 1;
        whoSignedSettings[_proposedSettings][msg.sender] == true;

        if (account.approvals >= requiredSignatures) {
            accountInfo[account.to];
        
            
        }

   }




//     for(uint i = 0; i Account< owners.length; i++) {
//         if (OwnersCheck[owners[i]] = true) {
//             approvals ++;
//         }

//         if (approvals >= requiredSignatures) {
//             accountInfo[msg.sender].withdrawdailyWithdrawlimit = dailyWithdrawlimit;
//             delete pendingWithdrawaldailyWithdrawlimit[msg.sender];
//             break;
//         }
//     }
//    }

    function withdraw(uint amount) public ownerOnly {
        require(amount <= accountInfo[msg.sender].withdrawdailyWithdrawlimit, "Exceeded withdraw limit");
        require(block.timestamp >= accountInfo[msg.sender].lastWithdrawalTimestamp + 1 days, "Daily limit haven't reset yet");
        require(amount <= address(this).balance, "Insufficient balance");
        payable(msg.sender).transfer(amount);
   }

        // View contract Spades balance 
   function spadesBalance() public view ownerOnly returns (uint256) {
    return address(this).balance;
   }

}