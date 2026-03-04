// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CaveauDigitaleV2.sol";
import "./mocks/MockERC20.sol";

/**
 * @title CaveauDigitaleV2 Fuzz Tests
 * @notice Property-based fuzz testing for the base savings vault.
 *         Forge runs each test with 10,000 random inputs to catch edge cases.
 */
contract CaveauDigitaleV2FuzzTest is Test {
    CaveauDigitaleV2 public vault;
    MockERC20 public token;

    address public alice = makeAddr("alice");
    address public bob   = makeAddr("bob");

    function setUp() public {
        vault = new CaveauDigitaleV2();
        token = new MockERC20("Mock USDC", "mUSDC", 6);

        // Fund alice with plenty of tokens
        token.mint(alice, 1_000_000_000e6);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);

        // Fund bob for gift deposits
        token.mint(bob, 1_000_000_000e6);
        vm.prank(bob);
        token.approve(address(vault), type(uint256).max);
    }

    // ─── Property 1: No withdrawal before unlock ──────────────
    /// @notice A DATE_ONLY vault must never allow withdrawal before unlockDate
    function testFuzz_cannotWithdrawBeforeUnlock(uint40 unlockDate, uint256 depositAmt) public {
        // Bound to realistic values
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, type(uint40).max));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), 0, unlockDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        vault.deposit(id, depositAmt);

        // Try to withdraw before unlock — must revert
        vm.prank(alice);
        vm.expectRevert(CaveauDigitaleV2.VaultLocked.selector);
        vault.withdraw(id);
    }

    // ─── Property 2: Withdrawal succeeds after unlock ─────────
    /// @notice A DATE_ONLY vault must allow withdrawal after unlockDate
    function testFuzz_canWithdrawAfterUnlock(uint40 unlockDate, uint256 depositAmt) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), 0, unlockDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        vault.deposit(id, depositAmt);

        // Warp past unlock date
        vm.warp(uint256(unlockDate) + 1);

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw(id);
        uint256 balAfter = token.balanceOf(alice);

        assertEq(balAfter - balBefore, depositAmt, "Must receive exact deposit");
    }

    // ─── Property 3: Non-owner cannot withdraw ────────────────
    /// @notice Only the vault owner can withdraw, even if unlocked
    function testFuzz_nonOwnerCannotWithdraw(uint40 unlockDate, uint256 depositAmt) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), 0, unlockDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        vault.deposit(id, depositAmt);

        vm.warp(uint256(unlockDate) + 1);

        // Bob tries to withdraw alice's vault — must revert
        vm.prank(bob);
        vm.expectRevert(CaveauDigitaleV2.NotOwner.selector);
        vault.withdraw(id);
    }

    // ─── Property 4: Double withdraw impossible ───────────────
    /// @notice Cannot withdraw from the same vault twice
    function testFuzz_cannotDoubleWithdraw(uint40 unlockDate, uint256 depositAmt) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), 0, unlockDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        vault.deposit(id, depositAmt);
        vm.warp(uint256(unlockDate) + 1);

        vm.prank(alice);
        vault.withdraw(id);

        // Second withdraw must revert
        vm.prank(alice);
        vm.expectRevert(CaveauDigitaleV2.AlreadyWithdrawn.selector);
        vault.withdraw(id);
    }

    // ─── Property 5: AMOUNT_ONLY unlock when target reached ───
    /// @notice AMOUNT_ONLY vault unlocks when deposits >= target, never before
    function testFuzz_amountOnlyUnlocksAtTarget(uint256 target, uint256 depositAmt) public {
        target = bound(target, 1, 500_000e6);
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), target, 0,
            CaveauDigitaleV2.UnlockMode.AMOUNT_ONLY, "Target", "T"
        );

        vm.prank(alice);
        vault.deposit(id, depositAmt);

        bool shouldBeUnlocked = depositAmt >= target;
        assertEq(vault.isUnlocked(id), shouldBeUnlocked, "Unlock state mismatch");

        if (shouldBeUnlocked) {
            vm.prank(alice);
            vault.withdraw(id);
        } else {
            vm.prank(alice);
            vm.expectRevert(CaveauDigitaleV2.VaultLocked.selector);
            vault.withdraw(id);
        }
    }

    // ─── Property 6: DATE_AND_AMT needs both conditions ───────
    /// @notice DATE_AND_AMT vault needs both date AND amount conditions met
    function testFuzz_dateAndAmtNeedsBoth(
        uint40 unlockDate, uint256 target, uint256 depositAmt, bool warpPastDate
    ) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        target = bound(target, 1, 500_000e6);
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), target, unlockDate,
            CaveauDigitaleV2.UnlockMode.DATE_AND_AMT, "Both", "B"
        );

        vm.prank(alice);
        vault.deposit(id, depositAmt);

        if (warpPastDate) {
            vm.warp(uint256(unlockDate) + 1);
        }

        bool dateMet = warpPastDate;
        bool amountMet = depositAmt >= target;
        bool shouldBeUnlocked = dateMet && amountMet;

        assertEq(vault.isUnlocked(id), shouldBeUnlocked, "DATE_AND_AMT unlock mismatch");
    }

    // ─── Property 7: DATE_OR_AMT needs either condition ───────
    /// @notice DATE_OR_AMT vault needs either date OR amount condition met
    function testFuzz_dateOrAmtNeedsEither(
        uint40 unlockDate, uint256 target, uint256 depositAmt, bool warpPastDate
    ) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        target = bound(target, 1, 500_000e6);
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), target, unlockDate,
            CaveauDigitaleV2.UnlockMode.DATE_OR_AMT, "Either", "E"
        );

        vm.prank(alice);
        vault.deposit(id, depositAmt);

        if (warpPastDate) {
            vm.warp(uint256(unlockDate) + 1);
        }

        bool dateMet = warpPastDate;
        bool amountMet = depositAmt >= target;
        bool shouldBeUnlocked = dateMet || amountMet;

        assertEq(vault.isUnlocked(id), shouldBeUnlocked, "DATE_OR_AMT unlock mismatch");
    }

    // ─── Property 8: Deposits accumulate correctly ────────────
    /// @notice Multiple deposits must sum to totalDeposited
    function testFuzz_depositsAccumulate(uint256 dep1, uint256 dep2, uint256 dep3) public {
        dep1 = bound(dep1, 1, 100_000e6);
        dep2 = bound(dep2, 1, 100_000e6);
        dep3 = bound(dep3, 1, 100_000e6);

        uint40 futureDate = uint40(block.timestamp) + 365 days;
        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), 0, futureDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "Sum", "S"
        );

        vm.prank(alice);
        vault.deposit(id, dep1);
        vm.prank(alice);
        vault.deposit(id, dep2);
        vm.prank(alice);
        vault.deposit(id, dep3);

        (,,,,uint256 total,,,,,) = vault.getVault(id);
        assertEq(total, dep1 + dep2 + dep3, "Deposits must sum correctly");
    }

    // ─── Property 9: Zero deposit reverts ─────────────────────
    /// @notice Depositing zero tokens must always revert
    function testFuzz_zeroDepositReverts(uint40 unlockDate) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, type(uint40).max));

        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), 0, unlockDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "Zero", "Z"
        );

        vm.prank(alice);
        vm.expectRevert(CaveauDigitaleV2.ZeroAmount.selector);
        vault.deposit(id, 0);
    }

    // ─── Property 10: Gift deposits work ──────────────────────
    /// @notice Anyone can deposit into any vault (gift deposits)
    function testFuzz_giftDeposit(uint256 depositAmt) public {
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        uint40 futureDate = uint40(block.timestamp) + 365 days;
        vm.prank(alice);
        uint256 id = vault.createVault(
            address(token), 0, futureDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "Gift", "G"
        );

        // Bob deposits into alice's vault
        vm.prank(bob);
        vault.deposit(id, depositAmt);

        (,,,,uint256 total,,,,,) = vault.getVault(id);
        assertEq(total, depositAmt, "Gift deposit must be tracked");
    }

    // ─── Property 11: Vault count tracks correctly ────────────
    /// @notice ownerVaultIds length must match number of created vaults
    function testFuzz_vaultCountTracksCorrectly(uint8 numVaults) public {
        numVaults = uint8(bound(numVaults, 1, 20));
        uint40 futureDate = uint40(block.timestamp) + 365 days;

        for (uint8 i = 0; i < numVaults; i++) {
            vm.prank(alice);
            vault.createVault(
                address(token), 0, futureDate,
                CaveauDigitaleV2.UnlockMode.DATE_ONLY, "V", "V"
            );
        }

        assertEq(vault.getOwnerVaultCount(alice), numVaults, "Vault count mismatch");
    }

    // ─── Property 12: Contract balance = sum of all deposits ──
    /// @notice The token balance of the contract must equal all non-withdrawn deposits
    function testFuzz_contractBalanceMatchesDeposits(uint256 dep1, uint256 dep2) public {
        dep1 = bound(dep1, 1, 100_000e6);
        dep2 = bound(dep2, 1, 100_000e6);

        uint40 futureDate = uint40(block.timestamp) + 365 days;

        vm.prank(alice);
        uint256 id1 = vault.createVault(
            address(token), 0, futureDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "V1", "1"
        );
        vm.prank(alice);
        uint256 id2 = vault.createVault(
            address(token), 0, futureDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, "V2", "2"
        );

        vm.prank(alice);
        vault.deposit(id1, dep1);
        vm.prank(alice);
        vault.deposit(id2, dep2);

        assertEq(
            token.balanceOf(address(vault)),
            dep1 + dep2,
            "Contract balance must match total deposits"
        );
    }

    // ─── Property 13: Name max length enforced ────────────────
    /// @notice Vault name > 64 bytes must revert
    function testFuzz_nameTooLongReverts(uint8 nameLen) public {
        nameLen = uint8(bound(nameLen, 65, 255));
        bytes memory longName = new bytes(nameLen);
        for (uint8 i = 0; i < nameLen; i++) {
            longName[i] = "A";
        }

        uint40 futureDate = uint40(block.timestamp) + 365 days;
        vm.prank(alice);
        vm.expectRevert(CaveauDigitaleV2.NameTooLong.selector);
        vault.createVault(
            address(token), 0, futureDate,
            CaveauDigitaleV2.UnlockMode.DATE_ONLY, string(longName), "X"
        );
    }
}
