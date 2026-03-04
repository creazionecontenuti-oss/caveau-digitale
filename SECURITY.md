# Security Policy

## Bug Bounty Program

PiggyVault runs a bug bounty program to reward security researchers who find and responsibly disclose vulnerabilities in our smart contracts.

### Scope

The following smart contracts deployed on **Polygon Mainnet** are in scope:

| Contract | Address | Explorer |
|---|---|---|
| **CaveauDigitaleV2** | `0x1FcbF2A6456aF7435c868666Be25774d92c2BA06` | [Polygonscan](https://polygonscan.com/address/0x1FcbF2A6456aF7435c868666Be25774d92c2BA06) |
| **CaveauAave** | `0xDF9c64E845C0E9D54175C7d567d5d0e0b9EE3501` | [Polygonscan](https://polygonscan.com/address/0xDF9c64E845C0E9D54175C7d567d5d0e0b9EE3501) |

Source code for both contracts is verified on Polygonscan and available in the [`contracts/`](./contracts/) directory.

### Recognition

| Severity | Recognition |
|---|---|
| **Critical** — Theft of funds, permanent freezing of funds | Hall of Fame + public credit in README & SECURITY-AUDIT.md |
| **High** — Temporary freezing of funds, unauthorized withdrawal bypass | Hall of Fame + public credit |
| **Medium** — Griefing attacks, unexpected state changes | Public credit in SECURITY-AUDIT.md |
| **Low** — Informational findings, gas optimizations | Acknowledgment in commit message |

All valid reporters will be credited in the project's **Security Hall of Fame** below. This is an open-source project — we value the community's help in keeping it safe.

### 🏆 Security Hall of Fame

*No reports yet — be the first!*

### Out of Scope

- Frontend (HTML/JS/CSS) vulnerabilities — these do not affect user funds
- Phishing or social engineering attacks
- Denial of service attacks on public RPC endpoints
- Issues in third-party dependencies (OpenZeppelin, Aave V3) — report these to the respective projects
- Known issues documented in [SECURITY-AUDIT.md](./SECURITY-AUDIT.md) (timestamp dependence, Slither false positives)
- Gas optimization suggestions (not a security issue)
- Issues requiring compromised user private keys

### Rules

1. **Do NOT exploit** any vulnerability on mainnet. Use a local fork or testnet.
2. **Do NOT disclose** the vulnerability publicly before it has been addressed.
3. Provide a **clear proof of concept** (PoC) — ideally a Foundry test.
4. One report per vulnerability. Duplicate reports will not be rewarded.
5. Reports must include steps to reproduce and estimated impact.

### How to Report

**Preferred:** Use [GitHub Private Vulnerability Reporting](https://github.com/creazionecontenuti-oss/caveau-digitale/security/advisories/new) — this keeps the report confidential and integrated with our workflow.

**Alternative:** Email [piggyvault.security@proton.me](mailto:piggyvault.security@proton.me)

Please include:
- Description of the vulnerability
- Affected contract(s) and function(s)
- Step-by-step reproduction instructions
- Proof of concept (Foundry test preferred)
- Estimated impact and severity

We will acknowledge your report within **48 hours** and aim to resolve critical issues within **7 days**.

### Safe Harbor

We will not pursue legal action against researchers who:
- Act in good faith and follow responsible disclosure
- Do not exploit the vulnerability beyond what is necessary for the PoC
- Do not access or modify other users' data or funds

## Supported Versions

| Contract | Version | Status |
|---|---|---|
| CaveauDigitaleV2 | Production | ✅ Actively monitored |
| CaveauAave | Production | ✅ Actively monitored |
| CaveauDigitale (V1) | Deprecated | ⚠️ No longer monitored — no user funds |

## Security Audit History

See [SECURITY-AUDIT.md](./SECURITY-AUDIT.md) for full audit results using:
- **Slither** (Trail of Bits) — static analysis
- **Mythril** (Consensys) — symbolic execution
- **Aderyn** (Cyfrin) — Rust-based static analysis (88 detectors)
- **Foundry** — fuzz testing (24 properties, 10,000 runs each)
- **SonarCloud** — continuous code quality
- **Snyk** — dependency scanning
