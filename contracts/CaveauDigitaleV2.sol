// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CaveauDigitaleV2
 * @notice Non-custodial time-lock & amount-lock savings vault on Polygon.
 *         V2 adds on-chain vault metadata (name, icon) so the frontend
 *         can reconstruct the vault list from any device without a database.
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
contract CaveauDigitaleV2 is ReentrancyGuard {
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
        string   name;           // vault display name (e.g. "Vacanza estiva")
        string   icon;           // vault icon emoji (e.g. "🏖️")
    }

    // ─── State ───────────────────────────────────────────────
    uint256 public nextVaultId;
    mapping(uint256 => Vault) public vaults;

    // Owner → list of their vault IDs (for enumeration)
    mapping(address => uint256[]) public ownerVaultIds;

    // ─── Events ──────────────────────────────────────────────
    event VaultCreated(
        uint256 indexed vaultId,
        address indexed owner,
        address token,
        UnlockMode unlockMode,
        uint256 targetAmount,
        uint40  unlockDate,
        string  name,
        string  icon
    );
    event Deposited(uint256 indexed vaultId, address indexed depositor, uint256 amount);
    event Withdrawn(uint256 indexed vaultId, uint256 amount);
    event VaultMetadataUpdated(uint256 indexed vaultId, string name, string icon);

    // ─── Errors ──────────────────────────────────────────────
    error InvalidMode();
    error DateMustBeFuture();
    error TargetMustBePositive();
    error NotOwner();
    error AlreadyWithdrawn();
    error VaultLocked();
    error ZeroAmount();
    error NameTooLong();

    // ─── Create ──────────────────────────────────────────────
    /**
     * @notice Create a new savings vault with metadata.
     * @param token        ERC-20 token to lock (e.g. USDC on Polygon)
     * @param targetAmount Target amount in token smallest units (set 0 for DATE_ONLY)
     * @param unlockDate   Unix timestamp for unlock (set 0 for AMOUNT_ONLY)
     * @param unlockMode   0=date, 1=amount, 2=OR, 3=AND
     * @param name         Display name for the vault (max 64 bytes)
     * @param icon         Emoji icon for the vault (max 16 bytes)
     */
    function createVault(
        address token,
        uint256 targetAmount,
        uint40  unlockDate,
        UnlockMode unlockMode,
        string calldata name,
        string calldata icon
    ) external returns (uint256 vaultId) {
        if (bytes(name).length > 64) revert NameTooLong();

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
            withdrawn:      false,
            name:           name,
            icon:           icon
        });

        ownerVaultIds[msg.sender].push(vaultId);

        emit VaultCreated(vaultId, msg.sender, token, unlockMode, targetAmount, unlockDate, name, icon);
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

    // ─── Update Metadata ─────────────────────────────────────
    /**
     * @notice Update vault name and icon. Only the vault owner can do this.
     */
    function updateVaultMetadata(uint256 vaultId, string calldata name, string calldata icon) external {
        Vault storage v = vaults[vaultId];
        if (msg.sender != v.owner) revert NotOwner();
        if (bytes(name).length > 64) revert NameTooLong();
        v.name = name;
        v.icon = icon;
        emit VaultMetadataUpdated(vaultId, name, icon);
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
        bool    unlocked,
        string memory name,
        string memory icon
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
            isUnlocked(vaultId),
            v.name,
            v.icon
        );
    }

    /**
     * @notice Get all vault IDs belonging to an owner.
     */
    function getOwnerVaults(address owner) external view returns (uint256[] memory) {
        return ownerVaultIds[owner];
    }

    /**
     * @notice Get the number of vaults belonging to an owner.
     */
    function getOwnerVaultCount(address owner) external view returns (uint256) {
        return ownerVaultIds[owner].length;
    }
}
