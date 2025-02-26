// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract SpadesProxy {
    address internal immutable singleton;

    constructor(address _singleton) payable {
        singleton = _singleton;
    }

    fallback() external payable {
        // Delegates ALL calls to singleton
        assembly {
            let _singleton := sload(0)
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(gas(), _singleton, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch success
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}