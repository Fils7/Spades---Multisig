// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "hardhat/console.sol";

/**
 * @title  Spades Multisig
 * @author  Filipe Reys
 *
 * @notice  This is a multisignature wallet that permits several owners
 *  to submit and sign on transactions, for an extra layer of security.
 * Who ever is an owner can revoke confirmations and set withdraw limits for 
 * the rest of the owners, if all agree.
*/

contract Spades {       

                        //////////////// EVENTS ///////////////////
                    //////////////////////////////////////////////////
                        //////////////////////////////////////////

        // Emits a deposit. 
    event Deposit (address sender, uint _value, uint _balance);
        // Transaction was submited. 
    event Submit (address _targetAccount, uint _amount, uint _txNonce, bytes data);
        // Transaction was signed.
    event Sign (address _owner, uint _txNonce);
        // Transaction executed.
    event transactionExecuted (address sender, uint _txNonce);
        // Transaction was revoked.
    event revoked (address sender, uint _txNonce);
        // Submits an account withdraw limit.
    event accountLimit (address _targetAccount, uint _amount, uint _setingsProposedNonce);
        // Signs an account limit.
    event signedSettings (address _owner, uint _setingsProposedNonce);
        // Triggers a withdraw.
    event withdrawEvent (address _owner, uint _amount);

   

                        //////////////// Global Variables ///////////////////
                    ///////////////////////////////////////////////////////////
                        ///////////////////////////////////////////////////


    address[] public owners;  // Array to store owners addresses.
    uint public requiredSignatures;  // Stores required signatures passed in the constructor.
    uint txNonce;  // Keeps track of tx nonce, starts at 0.
    uint setingsProposedNonce; // Keeps track of submited account settings nonce.


    mapping(address => bool) public OwnersCheck;
    mapping (uint => mapping (address => bool)) whoSignedTx; // Goes from an uint request (TxIndex) to the address (Owner) that signed a transaction.
    mapping (uint => mapping (address => bool)) whoSignedProposedSettings; // Goes from an uint request (settingIndex) to the address (Owner) that signed a proposed setting.    
    /// Equals true if that owner already signed.

    mapping (uint => Transaction) public txMap;  // Connects the uint TxIndex nonce to the struct Transaction.
    mapping (uint => ProposedSettings) public submitedSettingsMap; // Conects the settings proposed nonce to the struct proposedSettings.
    mapping (address => Settings) public accountSettings; // Connects the account (owner address) to the settings defined.


    struct ProposedSettings {

        uint confirmations;
        uint dailyWithdrawlimit;
        address owner;
    }

    struct Transaction {

        address targetAccount;
        uint amount;
        uint confirmations;
        bytes data;
    }

    struct Settings {

        uint withdrawLimit;
        uint withdrawTimestamp;
        
    }

                        //////////////// Modifiers  ///////////////////
                    ///////////////////////////////////////////////////////////
                        ///////////////////////////////////////////////////
                        

    modifier ownerOnly() {
        require(OwnersCheck[msg.sender], "You're not an owner of Spades"); // Checks if msg.sender is owner.
        _;
    }

    modifier txExists(uint _txIndex) {
        require(_txIndex < txNonce, "Tx doesn't exist"); // Checks if transaction exists. 
        _;
    }


                        ////////////////  Logic Functions  ///////////////////
                        ///////////////////////////////////////////////////////////
                        ///////////////////////////////////////////////////


    ///@notice Sets the number of owners and signatures needed.
    ///@dev Input of owners need to be more than zero. 
    // Signatures required need to be more than zero and less or equal to number of owners passed.

    constructor (address[] memory _owners, uint _signaturesRequired) payable {

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
    
    /// Contract can receive Ether. 
    receive() external payable {
        emit Deposit (msg.sender, msg.value, address(this).balance);
    }


    /// Submits a transaction _to (address) to be signed by required number of owners. 
    function submit(address payable _targetAccount, uint _amount, bytes memory _data) public ownerOnly {

        Transaction memory transaction = Transaction ({

            targetAccount: _targetAccount,
            amount: _amount,
            confirmations: 1,
            data: _data
    
        });

    ///@dev After submiting, the msg.sender is a signed owner;
    // txNonce incresases by one;

        txMap[txNonce] = transaction;
        whoSignedTx[txNonce][msg.sender] = true;
        txNonce ++;
        emit Submit(msg.sender, _amount, txNonce - 1, _data);
    }


    /// Signs a transaction that was submited from another owner.
    function signTransaction(uint txIndex) public ownerOnly txExists(txIndex) {

        Transaction storage transaction = txMap[txIndex];
        require(whoSignedTx[txIndex][msg.sender] == false);
        transaction.confirmations += 1;
        whoSignedTx[txIndex][msg.sender] = true;
        
        emit Sign (msg.sender, txIndex);
    }

    /// Revokes a signature that was already made.
    function revokeConfirmation(uint txIndex) public txExists(txIndex) ownerOnly {

        require(whoSignedTx[txIndex][msg.sender] == true, "You didn't sign this transaction");
        
        txMap[txIndex].confirmations -= 1;
        whoSignedTx[txIndex][msg.sender] = false;

        emit revoked (msg.sender, txIndex);
    }
    
    //// @notice Executes the transaction passed in submit function after reaching the required signatures;

   function executeTransaction(uint txIndex) public txExists(txIndex) {
        Transaction memory transaction = txMap[txIndex];

        require(transaction.confirmations >= requiredSignatures, "Not enough signatures");
        (bool success, ) = transaction.targetAccount.call{value: transaction.amount}(
            transaction.data);

        require(success, "Tx failed targetAccount execute");

        delete txMap[txIndex];
        
        emit transactionExecuted (msg.sender, txIndex);
   }

        ///@notice Will submit an account limit for the owner, to be signed and reach required signatures.
        ///@dev The last withdraw timestamp approved must be fetched for the address submited.

   function submitAccountLimit(address _account, uint _dailyWithdrawlimit) public ownerOnly {

        require(_dailyWithdrawlimit >= 0, "Invalid dailyWithdrawlimit");
        require(OwnersCheck[_account] = true, "Address does not match with any of the owners.");

        ProposedSettings memory proposedSettings  = ProposedSettings ({

            confirmations: 1,
            dailyWithdrawlimit: _dailyWithdrawlimit,
            owner: _account

        });

        submitedSettingsMap[setingsProposedNonce] = proposedSettings;
        whoSignedProposedSettings[setingsProposedNonce][msg.sender] = true;
        setingsProposedNonce ++;

        emit accountLimit ( _account, _dailyWithdrawlimit, setingsProposedNonce - 1);

    }
   


    ///@dev This signs the request for the setting, after reaching
    // the required signatures will execute by itself. Can only be called within this contract.

   function signSettings(uint _proposedSettingsIndex) internal {

        require(whoSignedProposedSettings[_proposedSettingsIndex][msg.sender] == false, "Owner already signed this settings");
        ProposedSettings memory proposedSettings = submitedSettingsMap[_proposedSettingsIndex];
        proposedSettings.confirmations += 1;
        whoSignedProposedSettings[_proposedSettingsIndex][msg.sender] == true;

        if (proposedSettings.confirmations >= requiredSignatures) {

            Settings memory settingsDefined = accountSettings[proposedSettings.owner];
            settingsDefined.withdrawLimit = proposedSettings.dailyWithdrawlimit;
            settingsDefined.withdrawTimestamp = block.timestamp;
            delete submitedSettingsMap[_proposedSettingsIndex];
            
        }
   }


   ///@notice Can make a withdraw if the amount is lesser or equal to the account daily withdraw limit.

    function withdraw(uint amount) public ownerOnly {

        Settings memory settingsDefined = accountSettings[msg.sender];
        require(amount <= accountSettings[msg.sender].withdrawLimit, "Exceeded withdraw limit");
        require(block.timestamp >= accountSettings[msg.sender].withdrawTimestamp + 1 days, "Daily limit haven't reset yet");
        require(amount <= address(this).balance, "Insufficient balance");
        payable(msg.sender).transfer(amount);

        emit withdrawEvent (msg.sender, amount);
   }

                            ////////////////  View Functions  ///////////////////
                    ///////////////////////////////////////////////////////////
                        ///////////////////////////////////////////////////

        // View contract Spades balance 
   function spadesBalance() public view ownerOnly returns (uint256) {
    return address(this).balance;
   }

       /// Returns a transaction when given the tx_index.
    function getTransaction(uint txIndex) public view returns (address targetAccount, uint amount, uint confirmations, bytes memory data) {
    
        Transaction memory transaction = txMap[txIndex];

        return (
            transaction.targetAccount,
            transaction.amount,
            transaction.confirmations,
            transaction.data);
    }

    /// Can check who already signed the transaction.
    function seeIfSigned(uint txIndex, address _owner) public view returns (bool) {
        return whoSignedTx[txIndex][_owner];
    }

}
    