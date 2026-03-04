// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CaveauAave.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockAavePool.sol";

/**
 * @title CaveauAave Fuzz Tests
 * @notice Property-based fuzz testing for the yield-bearing vault.
 *         The Aave V3 Pool is mocked at its real Polygon address using vm.etch.
 *         Forge runs each test with 10,000 random inputs.
 */
contract CaveauAaveFuzzTest is Test {
    CaveauAave  public caveau;
    MockERC20   public token;
    MockERC20   public aToken;
    MockAavePool public mockPool;

    address constant AAVE_POOL_ADDR = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;

    address public alice = makeAddr("alice");
    address public bob   = makeAddr("bob");
    address public admin;

    function setUp() public {
        // Deploy mock pool at a temporary address, then etch its code to the real address
        mockPool = new MockAavePool();
        vm.etch(AAVE_POOL_ADDR, address(mockPool).code);
        // Re-point mockPool reference to the real address for storage calls
        mockPool = MockAavePool(AAVE_POOL_ADDR);

        // Deploy tokens
        token  = new MockERC20("Mock USDC", "mUSDC", 6);
        aToken = new MockERC20("Aave mUSDC", "amUSDC", 6);

        // Register aToken in mock pool
        mockPool.registerAToken(address(token), address(aToken));

        // Deploy CaveauAave (deployer = admin = this test contract)
        caveau = new CaveauAave();
        admin = address(this);

        // Register token in CaveauAave
        caveau.setAToken(address(token), address(aToken));

        // Fund mock pool with underlying tokens to simulate withdrawals
        token.mint(AAVE_POOL_ADDR, 10_000_000_000e6);

        // Fund users
        token.mint(alice, 1_000_000_000e6);
        vm.prank(alice);
        token.approve(address(caveau), type(uint256).max);

        token.mint(bob, 1_000_000_000e6);
        vm.prank(bob);
        token.approve(address(caveau), type(uint256).max);
    }

    // ─── Property 1: No withdrawal before unlock ──────────────
    function testFuzz_cannotWithdrawBeforeUnlock(uint40 unlockDate, uint256 depositAmt) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, type(uint40).max));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = caveau.createVault(
            address(token), 0, unlockDate,
            CaveauAave.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        caveau.deposit(id, depositAmt);

        vm.prank(alice);
        vm.expectRevert(CaveauAave.VaultLocked.selector);
        caveau.withdraw(id);
    }

    // ─── Property 2: Withdrawal succeeds after unlock ─────────
    function testFuzz_canWithdrawAfterUnlock(uint40 unlockDate, uint256 depositAmt) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = caveau.createVault(
            address(token), 0, unlockDate,
            CaveauAave.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        caveau.deposit(id, depositAmt);

        vm.warp(uint256(unlockDate) + 1);

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        caveau.withdraw(id);
        uint256 balAfter = token.balanceOf(alice);

        // Should receive at least the deposited amount (no interest in mock = exact)
        assertGe(balAfter - balBefore, depositAmt, "Must receive at least deposit");
    }

    // ─── Property 3: Non-owner cannot withdraw ────────────────
    function testFuzz_nonOwnerCannotWithdraw(uint40 unlockDate, uint256 depositAmt) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = caveau.createVault(
            address(token), 0, unlockDate,
            CaveauAave.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        caveau.deposit(id, depositAmt);

        vm.warp(uint256(unlockDate) + 1);

        vm.prank(bob);
        vm.expectRevert(CaveauAave.NotVaultOwner.selector);
        caveau.withdraw(id);
    }

    // ─── Property 4: Double withdraw impossible ───────────────
    function testFuzz_cannotDoubleWithdraw(uint40 unlockDate, uint256 depositAmt) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, uint40(block.timestamp) + 365 days));
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = caveau.createVault(
            address(token), 0, unlockDate,
            CaveauAave.UnlockMode.DATE_ONLY, "Test", "T"
        );

        vm.prank(alice);
        caveau.deposit(id, depositAmt);
        vm.warp(uint256(unlockDate) + 1);

        vm.prank(alice);
        caveau.withdraw(id);

        vm.prank(alice);
        vm.expectRevert(CaveauAave.AlreadyWithdrawn.selector);
        caveau.withdraw(id);
    }

    // ─── Property 5: Shares increase proportionally ───────────
    /// @notice Two equal deposits must get equal shares
    function testFuzz_equalDepositsEqualShares(uint256 amount) public {
        amount = bound(amount, 1, 100_000e6);
        uint40 futureDate = uint40(block.timestamp) + 365 days;

        vm.prank(alice);
        uint256 id1 = caveau.createVault(
            address(token), 0, futureDate,
            CaveauAave.UnlockMode.DATE_ONLY, "V1", "1"
        );
        vm.prank(alice);
        uint256 id2 = caveau.createVault(
            address(token), 0, futureDate,
            CaveauAave.UnlockMode.DATE_ONLY, "V2", "2"
        );

        vm.prank(alice);
        caveau.deposit(id1, amount);
        vm.prank(alice);
        caveau.deposit(id2, amount);

        // Both vaults should have equal value
        uint256 val1 = caveau.getVaultValue(id1);
        uint256 val2 = caveau.getVaultValue(id2);

        // Allow 1 wei rounding error
        assertApproxEqAbs(val1, val2, 1, "Equal deposits must have equal value");
    }

    // ─── Property 6: Unsupported token reverts ────────────────
    function testFuzz_unsupportedTokenReverts(address randomToken) public {
        vm.assume(randomToken != address(token));
        vm.assume(randomToken != address(0));

        uint40 futureDate = uint40(block.timestamp) + 365 days;
        vm.prank(alice);
        vm.expectRevert(CaveauAave.TokenNotSupported.selector);
        caveau.createVault(
            randomToken, 0, futureDate,
            CaveauAave.UnlockMode.DATE_ONLY, "Bad", "B"
        );
    }

    // ─── Property 7: Only admin can register tokens ───────────
    function testFuzz_onlyAdminCanSetAToken(address caller) public {
        vm.assume(caller != admin);
        vm.prank(caller);
        vm.expectRevert(CaveauAave.NotAdmin.selector);
        caveau.setAToken(address(0x1234), address(0x5678));
    }

    // ─── Property 8: AMOUNT_ONLY uses vault value (incl. interest)
    function testFuzz_amountOnlyUsesVaultValue(uint256 target, uint256 depositAmt) public {
        target = bound(target, 1, 500_000e6);
        depositAmt = bound(depositAmt, 1, 1_000_000e6);

        vm.prank(alice);
        uint256 id = caveau.createVault(
            address(token), target, 0,
            CaveauAave.UnlockMode.AMOUNT_ONLY, "Target", "T"
        );

        vm.prank(alice);
        caveau.deposit(id, depositAmt);

        uint256 vaultValue = caveau.getVaultValue(id);
        bool shouldBeUnlocked = vaultValue >= target;
        assertEq(caveau.isUnlocked(id), shouldBeUnlocked, "AMOUNT_ONLY unlock mismatch");
    }

    // ─── Property 9: Zero deposit reverts ─────────────────────
    function testFuzz_zeroDepositReverts(uint40 unlockDate) public {
        unlockDate = uint40(bound(unlockDate, uint40(block.timestamp) + 1, type(uint40).max));

        vm.prank(alice);
        uint256 id = caveau.createVault(
            address(token), 0, unlockDate,
            CaveauAave.UnlockMode.DATE_ONLY, "Zero", "Z"
        );

        vm.prank(alice);
        vm.expectRevert(CaveauAave.ZeroAmount.selector);
        caveau.deposit(id, 0);
    }

    // ─── Property 10: Interest simulation ─────────────────────
    /// @notice Simulated Aave interest must be reflected in vault value
    function testFuzz_interestReflectedInValue(uint256 depositAmt, uint256 interestBps) public {
        depositAmt = bound(depositAmt, 1_000, 1_000_000e6);
        interestBps = bound(interestBps, 1, 5000); // 0.01% to 50%

        uint40 futureDate = uint40(block.timestamp) + 365 days;
        vm.prank(alice);
        uint256 id = caveau.createVault(
            address(token), 0, futureDate,
            CaveauAave.UnlockMode.DATE_ONLY, "Yield", "Y"
        );

        vm.prank(alice);
        caveau.deposit(id, depositAmt);

        // Simulate interest by minting extra aTokens to the contract
        uint256 interest = (depositAmt * interestBps) / 10000;
        aToken.mint(address(caveau), interest);

        uint256 vaultValue = caveau.getVaultValue(id);
        assertGe(vaultValue, depositAmt, "Value must be >= principal after interest");

        uint256 earned = caveau.getEarnedInterest(id);
        assertApproxEqAbs(earned, interest, 1, "Earned interest must match simulated");
    }

    // ─── Property 11: Vault count tracks correctly ────────────
    function testFuzz_vaultCountTracksCorrectly(uint8 numVaults) public {
        numVaults = uint8(bound(numVaults, 1, 20));
        uint40 futureDate = uint40(block.timestamp) + 365 days;

        for (uint8 i = 0; i < numVaults; i++) {
            vm.prank(alice);
            caveau.createVault(
                address(token), 0, futureDate,
                CaveauAave.UnlockMode.DATE_ONLY, "V", "V"
            );
        }

        assertEq(caveau.getOwnerVaultCount(alice), numVaults, "Vault count mismatch");
    }
}
