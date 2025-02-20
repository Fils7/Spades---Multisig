// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Spades - A Multi-Signature Wallet Implementation
/// @author Filipe Rey
/// @notice This contract allows multiple owners to manage funds and execute transactions
/// @dev Implementation of a multi-signature wallet without upgradeability
contract Spades {
    /// @notice Emitted when a new transaction is submitted
    /// @param _targetAccount The address that will receive the transaction
    /// @param _amount The amount of ETH to be sent
    /// @param _txNonce The unique identifier of the transaction
    /// @param data The calldata to be executed
    event Submit(
        address _targetAccount,
        uint _amount,
        uint _txNonce,
        bytes data
    );

    /// @notice Emitted when an owner signs a transaction
    /// @param _signer The address of the owner who signed
    /// @param _txNonce The transaction identifier
    event Sign(address _signer, uint _txNonce);

    /// @notice Emitted when a transaction is executed
    /// @param _executor The address that executed the transaction
    /// @param _txNonce The transaction identifier
    event transactionExecuted(address _executor, uint _txNonce);

    /// @notice Structure to store transaction details
    /// @dev Used to keep track of submitted transactions
    struct Transaction {
        address targetAccount; /// Destination address for the transaction
        uint amount; /// Amount of ETH to be sent
        uint confirmations; /// Number of confirmations received
        bytes data; /// Data to be executed
    }

    /// @notice Structure to store settings details
    /// @dev Used to keep track of settings
    struct Settings {
        uint withdrawLimit; /// Maximum amount of ETH that can be withdrawn per day
        uint withdrawTimestamp; /// Timestamp of the last withdrawal
    }

    /// @notice Mapping of transaction ID to Transaction struct
    mapping(uint => Transaction) public txMap;

    /// @notice Tracks which owners have signed which transactions
    mapping(uint => mapping(address => bool)) public whoSignedTx;

    /// @notice Mapping to check if an address is an owner
    mapping(address => bool) public isOwner;

    /// @notice Current transaction count, used as nonce
    uint public txNonce;

    /// @notice Number of signatures required to execute a transaction
    uint public signaturesRequired;

    /// @notice Array of owner addresses
    address[] public owners;

    modifier ownerOnly() {
        require(isOwner[msg.sender], "You don't own this Spade"); // Checks if msg.sender is owner.
        _;
    }

    modifier txExists(uint _txIndex) {
        require(_txIndex < txNonce, "Tx doesn't exist"); // Checks if transaction exists.
        _;
    }

    /// @notice Sets up the wallet with initial owners and signature requirements
    /// @param _owners Array of owner addresses
    /// @param _signaturesRequired Number of required signatures
    /// @dev This can only be called once during proxy setup
    function setup(address[] memory _owners, uint _signaturesRequired) public {
        require(_owners.length > 0, "Owners required");
        require(
            _signaturesRequired > 0 && _signaturesRequired <= _owners.length,
            "Invalid number of required signatures"
        );

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
        }

        signaturesRequired = _signaturesRequired;
    }

    /// @notice Submits a new transaction for approval
    /// @param _targetAccount Destination address
    /// @param _amount Amount of ETH to send
    /// @param _data Transaction data
    /// @dev Automatically signs transaction for submitter
    function submit(
        address _targetAccount,
        uint _amount,
        bytes memory _data
    ) public ownerOnly {
        require(_amount <= address(this).balance, "Insufficient balance");

        Transaction memory transaction = Transaction({
            targetAccount: _targetAccount,
            amount: _amount,
            confirmations: 1,
            data: _data
        });

        txMap[txNonce] = transaction;
        whoSignedTx[txNonce][msg.sender] = true;

        emit Submit(_targetAccount, _amount, txNonce, _data);
        txNonce++;
    }

    /// @notice Signs a pending transaction
    /// @param _txNonce The transaction ID to sign
    function signTransaction(uint _txNonce) public ownerOnly txExists(_txNonce) {
        require(!whoSignedTx[_txNonce][msg.sender], "Already signed");

        whoSignedTx[_txNonce][msg.sender] = true;
        txMap[_txNonce].confirmations += 1;

        emit Sign(msg.sender, _txNonce);
    }

    /// @notice Executes a transaction that has enough signatures
    /// @param _txNonce The transaction ID to execute
    function executeTransaction(uint _txNonce) public txExists(_txNonce) {
        Transaction storage transaction = txMap[_txNonce];
        require(
            transaction.confirmations >= signaturesRequired,
            "Not enough signatures"
        );

        (bool success, ) = transaction.targetAccount.call{
            value: transaction.amount
        }(transaction.data);
        require(success, "Transaction failed");

        emit transactionExecuted(msg.sender, _txNonce);
    }

    /// @notice Gets transaction details
    /// @param _txNonce The transaction ID
    /// @return Transaction memory The transaction details
    function getTransaction(
        uint _txNonce
    ) public view returns (Transaction memory) {
        require(_txNonce < txNonce, "Transaction does not exist");
        return txMap[_txNonce];
    }

    /// @notice Checks if an owner has signed a transaction
    /// @param _txNonce The transaction ID
    /// @param _signer The address to check
    /// @return bool True if the address has signed
    function seeIfSigned(
        uint _txNonce,
        address _signer
    ) public view returns (bool) {
        return whoSignedTx[_txNonce][_signer];
    }

    /// @notice Allows the contract to receive ETH
    receive() external payable {}
}
