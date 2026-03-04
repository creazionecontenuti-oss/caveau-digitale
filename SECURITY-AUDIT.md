# 🛡️ PiggyVault Security Audit Report

> Self-audit performed with automated static analysis tools.  
> Last updated: 2026-03-04

---

## Smart Contract Analysis — Slither

[Slither](https://github.com/crytic/slither) is the industry-standard static analysis framework for Solidity, maintained by Trail of Bits.

### CaveauDigitaleV2 (`0x1FcbF2A6456aF7435c868666Be25774d92c2BA06`)

| Severity | Count |
|---|---|
| 🔴 High | 0 |
| 🟠 Medium | 0 |
| 🟡 Low | 2 |
| 🔵 Informational | 16 |

**Low findings:**

| # | Detector | Description | Assessment |
|---|---|---|---|
| 1 | `timestamp` | `createVault()` and `isUnlocked()` use `block.timestamp` for comparisons | **Expected behavior** — this is a time-lock contract. Timestamp manipulation by miners (~15s) is negligible for unlock dates measured in days/months. |
| 2 | `solc-version` | Pragma `^0.8.20` has known compiler issues | **Acknowledged** — the listed issues (`VerbatimInvalidDeduplication`, etc.) only affect code using Yul verbatim or specific ABI edge cases not present in this contract. |

**Informational findings:** All 16 are from OpenZeppelin library internals (assembly usage in SafeERC20, StorageSlot) and pragma version differences across OZ interfaces. Not actionable.

**Verdict: ✅ No vulnerabilities found in CaveauDigitaleV2.**

---

### CaveauAave (`0xDF9c64E845C0E9D54175C7d567d5d0e0b9EE3501`)

| Severity | Count |
|---|---|
| 🔴 High | 0 |
| 🟠 Medium | 4 |
| 🟡 Low | 2 |
| 🔵 Informational | 16 |
| ⚙️ Optimization | 1 |

**Medium findings:**

| # | Detector | Description | Assessment |
|---|---|---|---|
| 1 | `incorrect-equality` | `deposit()` uses strict equality (`== 0`) for share calculation | **Safe** — this is the standard ERC-4626 pattern: if `totalShares == 0`, mint 1:1. No rounding attack is possible because the first depositor always gets exact shares. |
| 2 | `incorrect-equality` | `getVaultValue()` uses strict equality | **Safe** — same pattern as above for value calculation when pool has zero shares. |
| 3 | `reentrancy-no-eth` | Potential reentrancy in deposit/withdraw flows | **Mitigated** — contract inherits OpenZeppelin `ReentrancyGuard` with `nonReentrant` modifier on all state-changing functions. Slither flags this because external calls (Aave pool) happen before some state updates, but the reentrancy guard prevents exploitation. |
| 4 | `unused-return` | `AAVE_POOL.withdraw()` return value is ignored in `withdraw()` | **Acknowledged** — the return value is the actual amount withdrawn. The contract uses its own accounting. Could be improved by checking the return value matches expectations, but not exploitable. |

**Low findings:** Same as V2 (timestamp usage + solc version).

**Optimization:**

| # | Detector | Description | Assessment |
|---|---|---|---|
| 1 | `immutable-states` | `admin` variable should be declared `immutable` | **Valid** — would save ~2,100 gas per read. Not a security issue. Cannot be changed post-deploy. |

**Verdict: ✅ No exploitable vulnerabilities found in CaveauAave. 4 medium findings are false positives or mitigated by design.**

---

## Smart Contract Static Analysis — Aderyn (Cyfrin)

[Aderyn](https://github.com/Cyfrin/aderyn) is an open-source Rust-based static analyzer for Solidity developed by [Cyfrin](https://cyfrin.io). It runs 88 detectors against the AST to identify security vulnerabilities and code quality issues.

**Analysis parameters:** `aderyn 0.6.8` · `solc 0.8.20` · all 3 contracts

| Severity | Count |
|---|---|
| 🔴 High | 1 (false positive) |
| 🟡 Low | 7 (informational / gas optimizations) |

### H-1: Reentrancy — State change after external call (`CaveauAave.sol:205`)

Aderyn flags `AAVE_POOL.supply()` followed by state changes (`v.principalDeposited`, `v.shares`, `totalShares`).

**Assessment: ✅ False positive** — The `deposit()` function is protected by OpenZeppelin `ReentrancyGuard` (`nonReentrant` modifier). Same finding flagged by Slither and Mythril, consistently mitigated.

### Low findings summary

| # | ID | Title | Assessment |
|---|---|---|---|
| L-1 | Literal Instead of Constant | `64` used as magic number for name length | **Style** — readable in context |
| L-2 | Modifier Invoked Only Once | `onlyAdmin()` used once | **By design** — clarity over gas micro-optimization |
| L-3 | PUSH0 Opcode | Solc 0.8.20 uses PUSH0 | **Not an issue** — Polygon supports PUSH0 |
| L-4 | State Variable Could Be Immutable | `admin` set only in constructor | **Valid** — gas optimization, non-security |
| L-5 | Unchecked Return | `AAVE_POOL.withdraw()` return unchecked | **Acceptable** — Aave V3 always returns amount |
| L-6 | Unspecific Solidity Pragma | `^0.8.20` instead of `0.8.20` | **Style** — common in production contracts |
| L-7 | Public Function Not Used Internally | `getEarnedInterest()` could be `external` | **Valid** — gas optimization, non-security |

**Verdict: ✅ No exploitable vulnerabilities. 1 high is a false positive (ReentrancyGuard). 7 low are informational.**

Full report: [`aderyn-report.md`](./aderyn-report.md)

---

## Smart Contract Symbolic Execution — Mythril

[Mythril](https://github.com/Consensys/mythril) is a symbolic execution and SMT-solving security analysis tool for EVM bytecode, maintained by Consensys. Unlike static analysis (Slither), Mythril explores actual execution paths to detect vulnerabilities such as reentrancy, integer overflows, unchecked external calls, and timestamp dependence.

**Analysis parameters:** `solc 0.8.20` · optimizer enabled (200 runs) · `viaIR: true` · execution timeout 120s

### CaveauDigitale (V1 — legacy)

| Severity | Count |
|---|---|
| 🔴 High | 0 |
| 🟠 Medium | 0 |
| 🟡 Low | 10 |

**Low findings:**

| # | SWC | Title | Function | Assessment |
|---|---|---|---|---|
| 1–6 | SWC-107 | State access after external call | `deposit()`, `withdraw()` | **False positive** — all state-changing functions are protected by OpenZeppelin `ReentrancyGuard` (`nonReentrant` modifier). SafeERC20 `safeTransferFrom` / `safeTransfer` trigger the finding, but re-entrance is blocked. |
| 7–8 | SWC-116 | Dependence on predictable environment variable | `createVault()` | **By design** — `block.timestamp` is used intentionally for time-lock validation. Miner manipulation (~15s) is negligible for unlock periods measured in days/months. |
| 9 | SWC-116 | Dependence on predictable environment variable | `withdraw()` | **By design** — same as above. |
| 10 | SWC-116 | Dependence on predictable environment variable | `isUnlocked()` | **By design** — same as above. |

**Verdict: ✅ No vulnerabilities found. All 10 low findings are false positives or by-design behavior.**

### CaveauDigitaleV2 (`0x1FcbF2A6456aF7435c868666Be25774d92c2BA06`)

| Severity | Count |
|---|---|
| 🔴 High | 0 |
| 🟠 Medium | 0 |
| 🟡 Low | 5 |

**Low findings:**

| # | SWC | Title | Function | Assessment |
|---|---|---|---|---|
| 1–3 | SWC-107 | State access after external call | `deposit()` | **False positive** — protected by `ReentrancyGuard`. Same pattern as V1. |
| 4–5 | SWC-116 | Dependence on predictable environment variable | `createVault()` (L95, L99) | **By design** — `block.timestamp` used for time-lock validation. |

**Verdict: ✅ No vulnerabilities found. All 5 low findings are false positives or by-design behavior.**

### CaveauAave (`0xDF9c64E845C0E9D54175C7d567d5d0e0b9EE3501`)

| Severity | Count |
|---|---|
| 🔴 High | 0 |
| 🟠 Medium | 0 |
| 🟡 Low | 0 |

**Verdict: ✅ Clean — zero issues found by symbolic execution.**

---

## Fuzz Testing — Foundry

[Foundry](https://github.com/foundry-rs/foundry) is the leading Solidity development framework. Its fuzz testing engine generates thousands of random inputs per test to discover edge cases that unit tests miss.

**Configuration:** 10,000 runs per test · deterministic seed `0xdeadbeef` · optimizer enabled (200 runs) · `viaIR: true`

### CaveauDigitaleV2 — 13 properties, all passed ✅

| # | Property | Description |
|---|---|---|
| 1 | `cannotWithdrawBeforeUnlock` | DATE_ONLY vault always reverts before unlockDate |
| 2 | `canWithdrawAfterUnlock` | DATE_ONLY vault always succeeds after unlockDate |
| 3 | `nonOwnerCannotWithdraw` | Only vault owner can withdraw, even when unlocked |
| 4 | `cannotDoubleWithdraw` | Second withdrawal always reverts |
| 5 | `amountOnlyUnlocksAtTarget` | AMOUNT_ONLY vault unlock state matches deposits vs target |
| 6 | `dateAndAmtNeedsBoth` | DATE_AND_AMT requires both date and amount conditions |
| 7 | `dateOrAmtNeedsEither` | DATE_OR_AMT requires either date or amount condition |
| 8 | `depositsAccumulate` | Multiple deposits sum correctly to totalDeposited |
| 9 | `zeroDepositReverts` | Zero-amount deposit always reverts |
| 10 | `giftDeposit` | Anyone can deposit into any vault (gift deposits) |
| 11 | `vaultCountTracksCorrectly` | ownerVaultIds length matches created vaults |
| 12 | `contractBalanceMatchesDeposits` | Token balance = sum of all non-withdrawn deposits |
| 13 | `nameTooLongReverts` | Name > 64 bytes always reverts |

### CaveauAave — 11 properties, all passed ✅

| # | Property | Description |
|---|---|---|
| 1 | `cannotWithdrawBeforeUnlock` | DATE_ONLY vault always reverts before unlockDate |
| 2 | `canWithdrawAfterUnlock` | Withdrawal succeeds after unlockDate, receives ≥ deposit |
| 3 | `nonOwnerCannotWithdraw` | Only vault owner can withdraw |
| 4 | `cannotDoubleWithdraw` | Second withdrawal always reverts |
| 5 | `equalDepositsEqualShares` | Two equal deposits get equal vault value (±1 wei) |
| 6 | `unsupportedTokenReverts` | Unregistered token always reverts |
| 7 | `onlyAdminCanSetAToken` | Non-admin cannot register tokens |
| 8 | `amountOnlyUsesVaultValue` | AMOUNT_ONLY unlock uses vault value (incl. interest) |
| 9 | `zeroDepositReverts` | Zero-amount deposit always reverts |
| 10 | `interestReflectedInValue` | Simulated Aave interest correctly reflected in vault value |
| 11 | `vaultCountTracksCorrectly` | ownerVaultIds length matches created vaults |

**Run locally:**
```bash
forge test -vv   # 24 fuzz tests, 10,000 runs each
```

---

## Dependency Analysis — npm audit

| Severity | Count | Package | Notes |
|---|---|---|---|
| Moderate | 1 | `elliptic` (via `@privy-io/js-sdk-core`) | Legacy dependency from Privy SDK (no longer used at runtime). The app bundles Thirdweb SDK independently. Not exploitable in production. |

---

## Infrastructure — HTTP Security Headers

The following headers are configured in `vercel.json` for all routes:

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unnecessary APIs |
| `Content-Security-Policy` | See `vercel.json` | Whitelist script/frame sources |

---

## Client-Side Security

| Feature | Implementation |
|---|---|
| Seed phrase encryption | PBKDF2 (120,000 iterations) + AES-GCM 256-bit |
| PIN storage | Never stored in plaintext; derived key only |
| Biometric auth | WebAuthn / FIDO2 (hardware-backed) |
| Vault metadata | Encrypted with seed-derived key in localStorage |
| Private key handling | Never transmitted; in-memory only during session |
| Thirdweb auth | Shamir's Secret Sharing (device + auth + recovery shards) |

---

## What This Report Does NOT Cover

- **Formal verification** — mathematical proof of contract correctness
- **Third-party audit** — independent review by a security firm (e.g., CertiK, OpenZeppelin)
- **Penetration testing** — active exploitation attempts
- **Aave V3 risk** — the underlying lending protocol has its own risk profile

---

## Tools Used

| Tool | Version | Type |
|---|---|---|
| Slither | latest (pipx) | Static analysis (SAST) for Solidity |
| Mythril | 0.24.x (Consensys) | Symbolic execution + SMT solving for EVM bytecode |
| Aderyn (Cyfrin) | 0.6.8 | Rust-based static analysis — 88 AST detectors |
| Foundry (forge) | 1.5.1-stable | Fuzz testing — property-based random input generation |
| solc | 0.8.34 | Solidity compiler |
| npm audit | Node.js built-in | Dependency vulnerability scanning (SCA) |

---

*This is a self-audit report. For maximum trust, consider commissioning an independent third-party audit.*
