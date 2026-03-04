// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─── Minimal Aave V3 Pool interface ─────────────────────────
interface IAaveV3Pool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16  referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

/**
 * @title CaveauAave
 * @notice Yield-bearing savings vault on Polygon, powered by Aave V3.
 *         Deposits are supplied to the Aave lending pool to earn variable interest.
 *
 *         Uses a share-based accounting model (similar to ERC-4626) so that
 *         interest is distributed fairly across all vaults for the same token.
 *
 *         This contract is SEPARATE from CaveauDigitaleV2 (the base "stone vault")
 *         so that a bug here does NOT affect base vaults.
 *
 *  Unlock modes (same as V2):
 *    0 = DATE_ONLY   → withdrawable when block.timestamp >= unlockDate
 *    1 = AMOUNT_ONLY → withdrawable when currentValue >= targetAmount
 *    2 = DATE_OR_AMT → withdrawable when EITHER condition is met
 *    3 = DATE_AND_AMT→ withdrawable when BOTH conditions are met
 *
 *  Note: For amount-based unlocks, accrued interest counts toward the target.
 */
contract CaveauAave is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────
    // Aave V3 Pool on Polygon Mainnet
    IAaveV3Pool public constant AAVE_POOL =
        IAaveV3Pool(0x794a61358D6845594F94dc1DB02A252b5b4814aD);

    // ─── Types ────────────────────────────────────────────────
    enum UnlockMode { DATE_ONLY, AMOUNT_ONLY, DATE_OR_AMT, DATE_AND_AMT }

    struct Vault {
        address    owner;
        address    token;              // ERC-20 underlying (e.g. USDC)
        uint256    targetAmount;       // target in token smallest unit
        uint40     unlockDate;         // unix timestamp (0 if AMOUNT_ONLY)
        uint256    principalDeposited; // total principal deposited by user
        uint256    shares;             // this vault's share of the aToken pool
        UnlockMode unlockMode;
        bool       withdrawn;
        string     name;
        string     icon;
    }

    // ─── State ────────────────────────────────────────────────
    address public admin;              // contract deployer — can register tokens
    uint256 public nextVaultId;

    mapping(uint256 => Vault)      public vaults;
    mapping(address => uint256[])  public ownerVaultIds;

    // Per-token share accounting
    mapping(address => uint256) public totalShares;   // token → total shares
    mapping(address => address) public aTokens;       // token → Aave aToken address

    // ─── Events ───────────────────────────────────────────────
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
    event Deposited(uint256 indexed vaultId, address indexed depositor, uint256 amount, uint256 shares);
    event Withdrawn(uint256 indexed vaultId, uint256 principal, uint256 totalWithdrawn, uint256 interest);
    event VaultMetadataUpdated(uint256 indexed vaultId, string name, string icon);
    event ATokenRegistered(address indexed token, address indexed aToken);

    // ─── Errors ───────────────────────────────────────────────
    error InvalidMode();
    error DateMustBeFuture();
    error TargetMustBePositive();
    error NotVaultOwner();
    error NotAdmin();
    error AlreadyWithdrawn();
    error VaultLocked();
    error ZeroAmount();
    error NameTooLong();
    error TokenNotSupported();

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────
    constructor() {
        admin = msg.sender;
    }

    // ─── Admin ────────────────────────────────────────────────
    /**
     * @notice Register a supported token and its corresponding Aave aToken.
     *         Must be called before users can create vaults with this token.
     */
    function setAToken(address token, address aToken) external onlyAdmin {
        aTokens[token] = aToken;
        emit ATokenRegistered(token, aToken);
    }

    // ─── Internal helpers ─────────────────────────────────────
    function _aTokenBalance(address token) internal view returns (uint256) {
        address aToken = aTokens[token];
        if (aToken == address(0)) return 0;
        return IERC20(aToken).balanceOf(address(this));
    }

    // ─── Create ───────────────────────────────────────────────
    /**
     * @notice Create a new yield-bearing savings vault.
     */
    function createVault(
        address token,
        uint256 targetAmount,
        uint40  unlockDate,
        UnlockMode unlockMode,
        string calldata name,
        string calldata icon
    ) external returns (uint256 vaultId) {
        if (aTokens[token] == address(0)) revert TokenNotSupported();
        if (bytes(name).length > 64) revert NameTooLong();

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
            owner:              msg.sender,
            token:              token,
            targetAmount:       targetAmount,
            unlockDate:         unlockDate,
            principalDeposited: 0,
            shares:             0,
            unlockMode:         unlockMode,
            withdrawn:          false,
            name:               name,
            icon:               icon
        });

        ownerVaultIds[msg.sender].push(vaultId);

        emit VaultCreated(vaultId, msg.sender, token, unlockMode, targetAmount, unlockDate, name, icon);
    }

    // ─── Deposit ──────────────────────────────────────────────
    /**
     * @notice Deposit tokens into a vault. Tokens are immediately supplied
     *         to Aave to start earning interest.
     *         Caller must have approved this contract for `amount`.
     */
    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        Vault storage v = vaults[vaultId];
        if (v.withdrawn) revert AlreadyWithdrawn();
        if (amount == 0) revert ZeroAmount();
        if (aTokens[v.token] == address(0)) revert TokenNotSupported();

        // Transfer tokens from user to this contract
        IERC20(v.token).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate shares BEFORE supplying to Aave
        uint256 currentATokenBal = _aTokenBalance(v.token);
        uint256 newShares;
        if (totalShares[v.token] == 0 || currentATokenBal == 0) {
            newShares = amount; // 1:1 for first deposit
        } else {
            newShares = (amount * totalShares[v.token]) / currentATokenBal;
        }

        // Supply to Aave — contract receives aTokens
        IERC20(v.token).forceApprove(address(AAVE_POOL), amount);
        AAVE_POOL.supply(v.token, amount, address(this), 0);

        // Update accounting
        v.principalDeposited += amount;
        v.shares += newShares;
        totalShares[v.token] += newShares;

        emit Deposited(vaultId, msg.sender, amount, newShares);
    }

    // ─── Withdraw ─────────────────────────────────────────────
    /**
     * @notice Withdraw all funds (principal + interest) from a vault.
     *         Only the vault owner can call this, and only when unlocked.
     *         Funds are withdrawn from Aave and sent directly to the owner.
     */
    function withdraw(uint256 vaultId) external nonReentrant {
        Vault storage v = vaults[vaultId];
        if (msg.sender != v.owner) revert NotVaultOwner();
        if (v.withdrawn) revert AlreadyWithdrawn();
        if (!isUnlocked(vaultId)) revert VaultLocked();

        v.withdrawn = true;

        // Calculate total amount to withdraw (principal + accrued interest)
        uint256 currentATokenBal = _aTokenBalance(v.token);
        uint256 withdrawAmount;
        if (totalShares[v.token] == 0) {
            withdrawAmount = 0;
        } else {
            withdrawAmount = (v.shares * currentATokenBal) / totalShares[v.token];
        }

        // Update share accounting
        totalShares[v.token] -= v.shares;
        v.shares = 0;

        // Withdraw from Aave directly to vault owner
        if (withdrawAmount > 0) {
            AAVE_POOL.withdraw(v.token, withdrawAmount, v.owner);
        }

        uint256 interest = withdrawAmount > v.principalDeposited
            ? withdrawAmount - v.principalDeposited
            : 0;

        emit Withdrawn(vaultId, v.principalDeposited, withdrawAmount, interest);
    }

    // ─── Update Metadata ──────────────────────────────────────
    function updateVaultMetadata(
        uint256 vaultId,
        string calldata name,
        string calldata icon
    ) external {
        Vault storage v = vaults[vaultId];
        if (msg.sender != v.owner) revert NotVaultOwner();
        if (bytes(name).length > 64) revert NameTooLong();
        v.name = name;
        v.icon = icon;
        emit VaultMetadataUpdated(vaultId, name, icon);
    }

    // ─── View: Unlock check ───────────────────────────────────
    /**
     * @notice Check if a vault is unlocked.
     *         For amount-based modes, accrued interest counts toward the target.
     */
    function isUnlocked(uint256 vaultId) public view returns (bool) {
        Vault storage v = vaults[vaultId];
        bool dateMet   = block.timestamp >= v.unlockDate;
        bool amountMet = getVaultValue(vaultId) >= v.targetAmount;

        if (v.unlockMode == UnlockMode.DATE_ONLY)    return dateMet;
        if (v.unlockMode == UnlockMode.AMOUNT_ONLY)  return amountMet;
        if (v.unlockMode == UnlockMode.DATE_OR_AMT)  return dateMet || amountMet;
        if (v.unlockMode == UnlockMode.DATE_AND_AMT) return dateMet && amountMet;
        return false;
    }

    // ─── View: Current vault value ────────────────────────────
    /**
     * @notice Get the current value of a vault (principal + accrued interest).
     */
    function getVaultValue(uint256 vaultId) public view returns (uint256) {
        Vault storage v = vaults[vaultId];
        if (v.shares == 0 || totalShares[v.token] == 0) return 0;
        return (v.shares * _aTokenBalance(v.token)) / totalShares[v.token];
    }

    /**
     * @notice Get the interest earned so far on a vault.
     */
    function getEarnedInterest(uint256 vaultId) public view returns (uint256) {
        uint256 currentValue = getVaultValue(vaultId);
        Vault storage v = vaults[vaultId];
        return currentValue > v.principalDeposited
            ? currentValue - v.principalDeposited
            : 0;
    }

    // ─── View: Full vault info ────────────────────────────────
    /**
     * @notice Get full vault info in a single call (for the frontend).
     *         Returns V2-compatible fields plus currentValue and earnedInterest.
     */
    function getVault(uint256 vaultId) external view returns (
        address owner,
        address token,
        uint256 targetAmount,
        uint40  unlockDate,
        uint256 principalDeposited,
        UnlockMode unlockMode,
        bool    withdrawn,
        bool    unlocked,
        string memory name,
        string memory icon,
        uint256 currentValue,
        uint256 earnedInterest
    ) {
        Vault storage v = vaults[vaultId];
        uint256 val = getVaultValue(vaultId);
        uint256 interest = val > v.principalDeposited ? val - v.principalDeposited : 0;
        return (
            v.owner,
            v.token,
            v.targetAmount,
            v.unlockDate,
            v.principalDeposited,
            v.unlockMode,
            v.withdrawn,
            isUnlocked(vaultId),
            v.name,
            v.icon,
            val,
            interest
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
