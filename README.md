# 🔐 Caveau Digitale

> **Protocollo di Risparmio Inviolabile su Blockchain**

Una PWA (Progressive Web App) non-custodial che trasforma la forza di volontà in un vincolo matematico. I tuoi risparmi vengono bloccati in uno Smart Contract fino alla data che scegli — nessuno, nemmeno te, può toccarli prima.

**🌐 Demo live:** [piggyvault.xyz](https://piggyvault.xyz) · [caveau-digitale.vercel.app](https://caveau-digitale.vercel.app)

**🐙 IPFS (permanente):** [dweb.link](https://QmUVMCs4D1nGKstwzi3gdhfrTCcUyTCbWu4nXax6TeDoSS.ipfs.dweb.link/caveau-digitale/) · CID: `QmUVMCs4D1nGKstwzi3gdhfrTCcUyTCbWu4nXax6TeDoSS`

---

## Cos'è

Caveau Digitale è un'interfaccia personale per il protocollo di **Time-Locking** su blockchain Polygon. Puoi:

- Creare più salvadanai con obiettivi diversi (🏠 Casa, 🚗 Auto, ✈️ Vacanze, 💍 Matrimonio...)
- Impostare un importo target e una data di sblocco
- Registrare i versamenti mensili e seguire il progresso con grafici
- Recuperare tutto su qualsiasi dispositivo con le 12 parole della Seed Phrase

## Filosofia

> *"Non è una questione di forza di volontà. È una questione di matematica."*

Lo Smart Contract risponde con `REVERT` a ogni tentativo di prelievo anticipato. Non esiste operatore umano che possa annullarlo — nemmeno lo sviluppatore.

---

## Architettura

```
Nessun server  •  Nessun database  •  Nessun intermediario
```

| Componente | Tecnologia | Ruolo |
|---|---|---|
| Frontend | HTML5 + Tailwind CSS | Interfaccia utente |
| Wallet | ethers.js (BIP39) | Generazione seed phrase in-browser |
| Crittografia | Web Crypto API (PBKDF2 + AES-GCM) | Cifratura locale dei dati |
| Persistenza | localStorage (cifrato) | Nessun dato sui server |
| Grafici | Chart.js | Visualizzazione progressi |
| Smart Contract | CaveauDigitale.sol / Polygon | 4 modalità sblocco (data/importo/OR/AND) |
| Auto-Swap | Paraswap API v5 | Qualsiasi ERC-20 → valuta vault |
| Cross-Chain | SideShift API v2 | BTC/ETH/SOL/LTC/DOGE → USDC Polygon |
| Hosting | Vercel / IPFS (Pinata) | Deploy statico, zero costi |

## Sicurezza

- **Non-Custodial**: le chiavi private non lascono mai il dispositivo dell'utente
- **PIN locale**: 6 cifre cifrate con PBKDF2 (120.000 iterazioni) + AES-GCM 256-bit
- **Vault cifrati**: i metadati dei salvadanai sono cifrati con una chiave derivata dalla seed phrase
- **Zero trust**: lo sviluppatore non ha accesso a nessun dato di nessun utente
- **Recupero**: perdita del dispositivo → inserisci le 12 parole → tutto ripristinato

## Come Funziona

1. **Prima apertura**: Crea un nuovo portafoglio → scrivi le 12 parole su carta → imposta PIN
2. **Crea un vincolo**: Scegli obiettivo, importo target, valuta stabile (USDC/EURC/DAI), data sblocco
3. **Blocca i fondi**: Deposita direttamente, swappa qualsiasi token, o invia da Bitcoin/Ethereum
4. **Registra**: Inserisci nell'app l'importo versato → i grafici si aggiornano
5. **Aspetta**: Il countdown scende. La matematica fa il resto.

## Installazione PWA (Smartphone)

**iPhone (Safari):** Apri il link → Condividi → "Aggiungi a schermata Home"  
**Android (Chrome):** Apri il link → Menu → "Aggiungi alla schermata Home"

L'app si apre a schermo intero, funziona offline, non richiede App Store.

## Sviluppo Locale

```bash
git clone https://github.com/creazionecontenuti-oss/caveau-digitale
cd caveau-digitale
python3 -m http.server 8080
# Apri http://localhost:8080
```

Non sono necessari build tools, npm install o dipendenze. Un file HTML + un file JS.

## Deploy

```bash
npm i -g vercel
vercel --prod
```

## Roadmap

- [x] Smart Contract CaveauDigitale con 4 modalità sblocco
- [x] Auto-Swap qualsiasi token → valuta vault (Paraswap)
- [x] Depositi cross-chain BTC/ETH/SOL/LTC/DOGE (SideShift)
- [x] Auto-MATIC per gas con un click
- [x] Deploy su IPFS via Pinata
- [ ] Widget fiat on-ramp (Mt Pelerin / Transak) — bonifico → USDC automatico
- [ ] Account Abstraction (ERC-4337) per gasless nativo
- [ ] Supporto multi-chain (Base, Arbitrum)
- [ ] Notifiche push per avvicinarsi alla data di sblocco

## Licenza

MIT — Fai quello che vuoi. Se lo usi, considera una donazione:

```
0x742d35Cc6634C0532925a3b844f5E3E7e3901234 (Polygon)
```

---

*Costruito con la convinzione che la tecnologia debba servire la disciplina, non aggirarla.*
