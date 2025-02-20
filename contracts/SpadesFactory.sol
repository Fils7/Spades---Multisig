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

    function createWallet(address[] memory _owners, uint _signaturesRequired) 
        external 
        payable 
        returns (address) 
    {
        // Create new proxy
        SpadesProxy proxy = new SpadesProxy{value: msg.value}(singleton);
        
        // Setup the wallet - fix the conversion
        address payable proxyAddress = payable(address(proxy));
        Spades(proxyAddress).setup(_owners, _signaturesRequired);

        emit WalletCreated(proxyAddress, _owners, _signaturesRequired);
        return proxyAddress;
    }
}