// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CaveauDigitale
 * @notice Non-custodial time-lock & amount-lock savings vault on Polygon.
 *
 *  Unlock modes:
 *    0 = DATE_ONLY   → withdrawable when block.timestamp >= unlockDate
 *    1 = AMOUNT_ONLY → withdrawable when totalDeposited >= targetAmount
 *    2 = DATE_OR_AMT → withdrawable when EITHER condition is met
 *    3 = DATE_AND_AMT→ withdrawable when BOTH  conditions are met
 *
 *  The contract is intentionally non-cancelable: once a vault is created
 *  and funded, only the owner can withdraw — and only when isUnlocked().
 */
contract CaveauDigitale is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────
    enum UnlockMode { DATE_ONLY, AMOUNT_ONLY, DATE_OR_AMT, DATE_AND_AMT }

    struct Vault {
        address  owner;
        address  token;          // ERC-20 token address (e.g. USDC)
        uint256  targetAmount;   // target in token smallest unit
        uint40   unlockDate;     // unix timestamp (0 if AMOUNT_ONLY)
        uint256  totalDeposited; // running total of deposits
        UnlockMode unlockMode;
        bool     withdrawn;      // true after successful withdraw
    }

    // ─── State ───────────────────────────────────────────────
    uint256 public nextVaultId;
    mapping(uint256 => Vault) public vaults;

    // ─── Events ──────────────────────────────────────────────
    event VaultCreated(
        uint256 indexed vaultId,
        address indexed owner,
        address token,
        UnlockMode unlockMode,
        uint256 targetAmount,
        uint40  unlockDate
    );
    event Deposited(uint256 indexed vaultId, address indexed depositor, uint256 amount);
    event Withdrawn(uint256 indexed vaultId, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────
    error InvalidMode();
    error DateMustBeFuture();
    error TargetMustBePositive();
    error NotOwner();
    error AlreadyWithdrawn();
    error VaultLocked();
    error ZeroAmount();

    // ─── Create ──────────────────────────────────────────────
    /**
     * @notice Create a new savings vault.
     * @param token        ERC-20 token to lock (e.g. USDC on Polygon)
     * @param targetAmount Target amount in token smallest units (set 0 for DATE_ONLY)
     * @param unlockDate   Unix timestamp for unlock (set 0 for AMOUNT_ONLY)
     * @param unlockMode   0=date, 1=amount, 2=OR, 3=AND
     */
    function createVault(
        address token,
        uint256 targetAmount,
        uint40  unlockDate,
        UnlockMode unlockMode
    ) external returns (uint256 vaultId) {
        // Validate based on mode
        if (unlockMode == UnlockMode.DATE_ONLY) {
            if (unlockDate <= uint40(block.timestamp)) revert DateMustBeFuture();
        } else if (unlockMode == UnlockMode.AMOUNT_ONLY) {
            if (targetAmount == 0) revert TargetMustBePositive();
        } else if (unlockMode == UnlockMode.DATE_OR_AMT || unlockMode == UnlockMode.DATE_AND_AMT) {
            if (unlockDate <= uint40(block.timestamp)) revert DateMustBeFuture();
            if (targetAmount == 0) revert TargetMustBePositive();
        } else {
            revert InvalidMode();
        }

        vaultId = nextVaultId++;
        vaults[vaultId] = Vault({
            owner:          msg.sender,
            token:          token,
            targetAmount:   targetAmount,
            unlockDate:     unlockDate,
            totalDeposited: 0,
            unlockMode:     unlockMode,
            withdrawn:      false
        });

        emit VaultCreated(vaultId, msg.sender, token, unlockMode, targetAmount, unlockDate);
    }

    // ─── Deposit ─────────────────────────────────────────────
    /**
     * @notice Deposit tokens into an existing vault.
     *         Caller must have approved this contract first.
     *         Anyone can deposit into any vault (gift deposits allowed).
     */
    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        Vault storage v = vaults[vaultId];
        if (v.withdrawn) revert AlreadyWithdrawn();
        if (amount == 0) revert ZeroAmount();

        IERC20(v.token).safeTransferFrom(msg.sender, address(this), amount);
        v.totalDeposited += amount;

        emit Deposited(vaultId, msg.sender, amount);
    }

    // ─── Withdraw ────────────────────────────────────────────
    /**
     * @notice Withdraw all deposited tokens. Only vault owner, only when unlocked.
     */
    function withdraw(uint256 vaultId) external nonReentrant {
        Vault storage v = vaults[vaultId];
        if (msg.sender != v.owner) revert NotOwner();
        if (v.withdrawn) revert AlreadyWithdrawn();
        if (!isUnlocked(vaultId)) revert VaultLocked();

        v.withdrawn = true;
        uint256 amount = v.totalDeposited;
        IERC20(v.token).safeTransfer(v.owner, amount);

        emit Withdrawn(vaultId, amount);
    }

    // ─── View ────────────────────────────────────────────────
    /**
     * @notice Check if a vault's unlock condition is satisfied.
     */
    function isUnlocked(uint256 vaultId) public view returns (bool) {
        Vault storage v = vaults[vaultId];
        bool dateMet   = block.timestamp >= v.unlockDate;
        bool amountMet = v.totalDeposited >= v.targetAmount;

        if (v.unlockMode == UnlockMode.DATE_ONLY)    return dateMet;
        if (v.unlockMode == UnlockMode.AMOUNT_ONLY)  return amountMet;
        if (v.unlockMode == UnlockMode.DATE_OR_AMT)   return dateMet || amountMet;
        if (v.unlockMode == UnlockMode.DATE_AND_AMT)  return dateMet && amountMet;
        return false;
    }

    /**
     * @notice Get full vault info in a single call (for the frontend).
     */
    function getVault(uint256 vaultId) external view returns (
        address owner,
        address token,
        uint256 targetAmount,
        uint40  unlockDate,
        uint256 totalDeposited,
        UnlockMode unlockMode,
        bool    withdrawn,
        bool    unlocked
    ) {
        Vault storage v = vaults[vaultId];
        return (
            v.owner,
            v.token,
            v.targetAmount,
            v.unlockDate,
            v.totalDeposited,
            v.unlockMode,
            v.withdrawn,
            isUnlocked(vaultId)
        );
    }
}
