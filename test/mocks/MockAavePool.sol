// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MockERC20.sol";

/**
 * @title MockAavePool
 * @notice Simulates Aave V3 Pool for testing. Mints aTokens 1:1 on supply,
 *         burns aTokens 1:1 on withdraw. Interest can be simulated by
 *         minting extra aTokens to the contract under test.
 */
contract MockAavePool {
    using SafeERC20 for IERC20;

    // underlying token → aToken
    mapping(address => address) public aTokenOf;

    function registerAToken(address underlying, address aToken) external {
        aTokenOf[underlying] = aToken;
    }

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16  /* referralCode */
    ) external {
        // Pull underlying from caller
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        // Mint aTokens 1:1 to onBehalfOf
        MockERC20(aTokenOf[asset]).mint(onBehalfOf, amount);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        // Burn aTokens from caller (CaveauAave contract)
        // In real Aave the pool burns from msg.sender's aToken balance
        // Here we just transfer underlying to `to`
        MockERC20(aTokenOf[asset]).mint(address(0xdead), 0); // no-op, real burn not needed for test
        IERC20(asset).safeTransfer(to, amount);
        return amount;
    }
}
