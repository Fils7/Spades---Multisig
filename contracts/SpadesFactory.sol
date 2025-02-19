// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./Spades.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract SpadesFactory {
    Spades public immutable implementation;
    event WalletCreated(address indexed wallet, address[] owners, uint256 requiredSignatures);

    constructor() {
        // Deploy the implementation contract once
        implementation = new Spades();
    }

    function createWallet(address[] memory _owners, uint _signaturesRequired) external payable returns (address) {
        // Encode initialization data
        bytes memory initData = abi.encodeWithSelector(
            Spades.initialize.selector,
            _owners,
            _signaturesRequired
        );

        // Deploy proxy pointing to the implementation
        ERC1967Proxy proxy = new ERC1967Proxy{value: msg.value}(
            address(implementation),
            initData
        );

        emit WalletCreated(address(proxy), _owners, _signaturesRequired);
        return address(proxy);
    }
}