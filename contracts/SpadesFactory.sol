// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./Spades.sol";
import "./SpadesProxy.sol";

contract SpadesFactory {
    address public immutable singleton;
    event WalletCreated(address indexed wallet, address[] owners, uint256 requiredSignatures);

    constructor(address _singleton) {
        require(_singleton != address(0), "Invalid singleton");
        singleton = _singleton;
    }

    function createWallet(address[] memory _owners, uint _signaturesRequired) public returns (address) {
        // Create new proxy
        SpadesProxy proxy = new SpadesProxy(singleton);
        
        // Get proxy address
        address payable proxyAddress = payable(address(proxy));
        
        // Setup the wallet through proxy
        Spades(proxyAddress).setup(_owners, _signaturesRequired);

        // Verify setup was successful
        uint ownerCount = Spades(proxyAddress).getOwnerCount();
        require(ownerCount == _owners.length, "Setup failed: owner count mismatch");
        
        emit WalletCreated(proxyAddress, _owners, _signaturesRequired);
        return proxyAddress;
    }
}