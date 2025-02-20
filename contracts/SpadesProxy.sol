// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract SpadesProxy {
    // Only handles delegation to singleton
    address internal immutable singleton;

    constructor(address _singleton) payable {
        singleton = _singleton;
    }

    fallback() external payable {
        // Delegates all calls to the Spades singleton
    }
}