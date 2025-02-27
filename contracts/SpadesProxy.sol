// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract SpadesProxy {
    address public immutable singleton;

    constructor(address _singleton) payable {
        require(_singleton != address(0), "Invalid singleton");
        singleton = _singleton;
    }

    fallback() external payable {
        _delegate(singleton);
    }

    receive() external payable {}

    function _delegate(address _implementation) internal {
        assembly {
            // Copy msg.data
            calldatacopy(0, 0, calldatasize())

            // Call implementation
            let result := delegatecall(
                gas(),
                _implementation,
                0,
                calldatasize(),
                0,
                0
            )

            // Copy return data
            let size := returndatasize()
            returndatacopy(0, 0, size)

            switch result
            case 0 {
                revert(0, size)
            }
            default {
                return(0, size)
            }
        }
    }
}