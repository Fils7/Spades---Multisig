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
    event TransactionExecuted(address _executor, uint _txNonce);

    /// @notice Event emitted when a Schnorr signature is used
    event SchnorrSignatureUsed(address indexed signer, uint indexed txNonce, bytes32 publicNonce);

    /// @notice Structure to store transaction details
    /// @dev Used to keep track of submitted transactions
    struct Transaction {
        address targetAccount;
        uint amount;
        uint confirmations;
        bytes data;
        bool executed;
        uint proposedAt;
    }

    /// @notice Structure to store signature type and data
    struct SignatureData {
        bool isSchnorr;      // true for Schnorr, false for ECDSA
        bytes signature;      // Raw signature data
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
    mapping(address => bool) internal isOwner;

    /// @notice Mapping to store signature data for each transaction and signer
    mapping(uint => mapping(address => SignatureData)) public signatures;

    /// @notice Mapping to track used nonces for replay protection
    mapping(bytes32 => bool) public usedNonces;
    

    /// @notice Current transaction count, used as nonce
    uint public txNonce;

    /// @notice Number of signatures required to execute a transaction
    uint public signaturesRequired;

    /// @notice Array of owner addresses
    address[] public owners;

    /// @notice Boolean to check if the contract has been initialized
    bool private initialized;


    /// @notice Schnorr verification parameters
    uint256 constant Q = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

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
        require(!initialized, "Already initialized");
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
        initialized = true;
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
            data: _data,
            executed: false,
            proposedAt: block.timestamp
        });

        txMap[txNonce] = transaction;
        whoSignedTx[txNonce][msg.sender] = true;

        emit Submit(_targetAccount, _amount, txNonce, _data);
        txNonce++;
    }

    /// @notice Verifies a Schnorr signature following Safe's approach
    /// @param commitment Message hash
    /// @param signature Encoded signature data (px, e, s, parity)
    function ecrecoverSchnorr(
        bytes32 commitment,
        bytes calldata signature
    ) public pure returns (address) {
        (bytes32 px, bytes32 e, bytes32 s, uint8 parity) = abi.decode(
            signature,
            (bytes32, bytes32, bytes32, uint8)
        );

        bytes32 sp = bytes32(Q - mulmod(uint256(s), uint256(px), Q));
        bytes32 ep = bytes32(Q - mulmod(uint256(e), uint256(px), Q));

        require(sp != bytes32(Q), "Invalid s value");
        
        address R = ecrecover(sp, parity, px, ep);
        require(R != address(0), "ecrecover failed");
        
        require(
            e == keccak256(abi.encodePacked(R, uint8(parity), px, commitment)),
            "Invalid Schnorr signature"
        );
        
        return address(uint160(uint256(px)));
    }

    /// @notice Signs a transaction with Schnorr signature
    function signTransaction(
        uint _txNonce,
        bytes calldata _signature,
        bool _isSchnorr
    ) public ownerOnly txExists(_txNonce) {
        require(!whoSignedTx[_txNonce][msg.sender], "Already signed");
        
        Transaction storage transaction = txMap[_txNonce];

        // Create commitment hash including chainId and nonce for replay protection
        bytes32 commitment = keccak256(
            abi.encode(
                address(this),
                block.chainid,
                _txNonce,
                transaction.targetAccount,
                transaction.amount,
                transaction.data
            )
        );

        if (_isSchnorr) {
            address signer = ecrecoverSchnorr(commitment, _signature);
            require(signer == msg.sender, "Invalid signer");
            emit SchnorrSignatureUsed(msg.sender, _txNonce, commitment);
        } else {
            // Traditional ECDSA verification
            bytes32 ethSignedMessageHash = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", commitment)
            );
            address signer = recoverSigner(ethSignedMessageHash, _signature);
            require(signer == msg.sender, "Invalid ECDSA signature");
        }

        // Store signature data
        signatures[_txNonce][msg.sender] = SignatureData({
            isSchnorr: _isSchnorr,
            signature: _signature
        });

        whoSignedTx[_txNonce][msg.sender] = true;
        txMap[_txNonce].confirmations += 1;

        emit Sign(msg.sender, _txNonce);
    }

    /// @notice Executes a transaction that has enough signatures
    /// @param _txNonce The transaction ID to execute
    function executeTransaction(uint _txNonce) public txExists(_txNonce) {
        Transaction storage transaction = txMap[_txNonce];
        require(!transaction.executed, "Transaction already executed");
        require(
            transaction.confirmations >= signaturesRequired,
            "Not enough signatures"
        );

        transaction.executed = true;  // Mark as executed before making the call
        
        (bool success, ) = transaction.targetAccount.call{
            value: transaction.amount
        }(transaction.data);
        require(success, "Transaction failed");

        emit TransactionExecuted(msg.sender, _txNonce);
    }

    /// @notice Helper function to recover signer from ECDSA signature
    function recoverSigner(bytes32 _hash, bytes memory _signature) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }

        return ecrecover(_hash, v, r, s);
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

    /// @notice Debug function to check if proxy is working
    function getImplementationAddress() public view returns (address) {
        return address(this);
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

        /// @notice Gets the signature data for a transaction
    /// @param _txNonce The transaction ID
    /// @param _signer The signer address
    /// @return SignatureData memory The signature data
    function getSignatureData(
        uint _txNonce,
        address _signer
    ) public view returns (SignatureData memory) {
        return signatures[_txNonce][_signer];
    }

    /// @notice Checks if a nonce has been used
    /// @param _signer The signer address
    /// @param _publicNonce The public nonce to check
    /// @return bool True if the nonce has been used
    function isNonceUsed(
        address _signer,
        bytes32 _publicNonce
    ) public view returns (bool) {
        return usedNonces[keccak256(abi.encodePacked(_signer, _publicNonce))];
    }

    /// @notice Get the number of owners
    function getOwnerCount() public view returns (uint256) {
        return owners.length;
    }

    /// @notice Debug function to check initialization
    function isInitialized() public view returns (bool) {
        return initialized;
    }

    /// @notice Allows the contract to receive ETH
    receive() external payable {}
}
