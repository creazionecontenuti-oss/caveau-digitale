// ============================================================
// CAVEAU DIGITALE — app.js
// Non-Custodial Web3 Time-Lock Savings Protocol
// ============================================================

const STORAGE = {
  ADDRESS:   'caveau_address',
  SEED_ENC:  'caveau_seed_enc',   // mnemonic encrypted with PIN-derived key
  VAULTS_ENC:'caveau_vaults_enc', // vaults encrypted with mnemonic-derived key
  PIN_SALT:  'caveau_pin_salt'
};

const DONATION_ADDRESS = '0xa359bb875A08b0A392541638Aa614a2e59D63b2C';

// ─── Blockchain Config (Polygon Mainnet) ─────────────────────
const POLYGON_RPC     = 'https://1rpc.io/matic';
const CAVEAU_CONTRACT = '0x567a90cfaCdFb4B650727A005A6f394c22A993a9';
const TOKEN_ADDRESSES = {
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  EURC: '0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD',
  DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
};
const TOKEN_DECIMALS  = { USDC: 6, EURC: 6, DAI: 18, USDT: 6 };
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)'
];
const CAVEAU_ABI = [
  'function createVault(address token, uint256 targetAmount, uint40 unlockDate, uint8 unlockMode) external returns (uint256 vaultId)',
  'function deposit(uint256 vaultId, uint256 amount) external',
  'function withdraw(uint256 vaultId) external',
  'function isUnlocked(uint256 vaultId) view returns (bool)',
  'function getVault(uint256 vaultId) view returns (address owner, address token, uint256 targetAmount, uint40 unlockDate, uint256 totalDeposited, uint8 unlockMode, bool withdrawn, bool unlocked)',
  'function nextVaultId() view returns (uint256)'
];
const UNLOCK_MODES = [
  { label: '📅 A una data',            hint: 'Si apre quando arriva la data che scegli.' },
  { label: '💰 A una cifra',            hint: 'Si apre quando raggiungi la cifra che vuoi.' },
  { label: '📅 o 💰 Il primo dei due',  hint: 'Si apre quando arriva la data OPPURE raggiungi la cifra.' },
  { label: '📅 + 💰 Tutti e due',       hint: 'Si apre solo quando arriva la data E hai raggiunto la cifra.' }
];

// ─── Auto-Swap Config (Paraswap) ────────────────────────────
const PARASWAP_API = 'https://apiv5.paraswap.io';
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const SWAP_TOKENS = [
  { symbol: 'MATIC', address: NATIVE_TOKEN,                                    decimals: 18 },
  { symbol: 'WETH',  address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
  { symbol: 'WBTC',  address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8 },
  { symbol: 'LINK',  address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', decimals: 18 },
  { symbol: 'AAVE',  address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', decimals: 18 },
  { symbol: 'UNI',   address: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f', decimals: 18 },
];

// ─── Cross-Chain Config (SideShift) ─────────────────────────
const SIDESHIFT_API = 'https://sideshift.ai/api/v2';
const CROSS_CHAINS = [
  { symbol: 'BTC',  network: 'bitcoin',  label: 'Bitcoin',   icon: '₿', method: 'btc' },
  { symbol: 'ETH',  network: 'ethereum', label: 'Ethereum',  icon: 'Ξ', method: 'eth' },
  { symbol: 'SOL',  network: 'solana',   label: 'Solana',    icon: '◎', method: 'sol' },
  { symbol: 'LTC',  network: 'litecoin', label: 'Litecoin',  icon: 'Ł', method: 'ltc' },
  { symbol: 'DOGE', network: 'dogecoin', label: 'Dogecoin',  icon: '🐕', method: 'doge' },
  { symbol: 'USDT', network: 'tron',     label: 'USDT',      icon: '💲', method: 'usdttron' },
  { symbol: 'USDC', network: 'ethereum', label: 'USDC',      icon: '💵', method: 'usdceth' },
];
const SETTLE_METHODS = { USDC: 'usdcpolygon', USDT: 'usdtpolygon', DAI: 'daipolygon', EURC: 'eurcpolygon' };

const PRESETS = [
  { icon: '🏠', name: 'Casa',       color: '#f59e0b' },
  { icon: '🚗', name: 'Auto',       color: '#3b82f6' },
  { icon: '✈️',  name: 'Vacanze',   color: '#8b5cf6' },
  { icon: '💍', name: 'Matrimonio', color: '#ec4899' },
  { icon: '🎓', name: 'Istruzione', color: '#10b981' },
  { icon: '🚑', name: 'Emergenze',  color: '#ef4444' },
  { icon: '💻', name: 'Tech',       color: '#06b6d4' },
  { icon: '🏖️', name: 'Mare',       color: '#f97316' },
  { icon: '🏍️', name: 'Moto',       color: '#84cc16' },
  { icon: '💰', name: 'Risparmio',  color: '#6366f1' }
];

// ─── Public App namespace ──────────────────────────────────
const App = {};

// Expose modal helpers early so inline onclick handlers can resolve them
App.openModal  = id => document.getElementById(id)?.classList.add('active');
App.closeModal = id => {
  document.getElementById(id)?.classList.remove('active');
  if (id === 'modal-onramp') document.getElementById('onramp-iframe').src = '';
};

// ─── State ───────────────────────────────────────────────────
const state = {
  address:        null,
  vaultKey:       null,  // CryptoKey for vault encryption (derived from mnemonic)
  vaults:         [],
  currentVaultId: null,
  selectedPreset: PRESETS[9],
  dashChart:      null,
  vaultChart:     null,
  tempMnemonic:   null,  // only during onboarding
  pinBuffer:        { set: '', unlock: '' },
  pinStage:         'first', // 'first' | 'confirm'
  pinFirst:         '',
  afterRestorePin:  false,  // true when PIN set comes after restore
  walletSigner:     null,   // ethers.Wallet connected to Polygon provider
  pinVerifyBuffer:  '',
  pinVerifyCallback: null,
  currentLockAmount: 0,
  selectedUnlockMode: 0  // 0=date, 1=amount, 2=OR, 3=AND
};

// ─── Crypto Helpers ──────────────────────────────────────────
async function deriveKeyFromString(str, salt) {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(str), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encrypt(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return JSON.stringify({ iv: [...iv], d: [...new Uint8Array(enc)] });
}

async function decrypt(key, blob) {
  const { iv, d } = JSON.parse(blob);
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(d)
  );
  return JSON.parse(new TextDecoder().decode(dec));
}

function randomSalt() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2,'0')).join('');
}

function fakeHash() {
  return '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2,'0')).join('');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

// ─── Storage ─────────────────────────────────────────────────
async function saveVaults() {
  if (!state.vaultKey) return;
  localStorage.setItem(STORAGE.VAULTS_ENC, await encrypt(state.vaultKey, state.vaults));
}

async function loadVaults() {
  const blob = localStorage.getItem(STORAGE.VAULTS_ENC);
  if (!blob || !state.vaultKey) { state.vaults = []; return; }
  try { state.vaults = await decrypt(state.vaultKey, blob); }
  catch { state.vaults = []; }
}

// ─── Screen helpers ──────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 5000);
}

// ─── PIN pad ─────────────────────────────────────────────────
function updatePinDots(context, len) {
  const id = context === 'set' ? 'pin-dots-set' : 'pin-dots-unlock';
  document.querySelectorAll(`#${id} .pin-dot`).forEach((d, i) => {
    d.classList.toggle('filled', i < len);
  });
}

App.pinKeyPress = function(digit, context) {
  const buf = state.pinBuffer;
  if (buf[context].length >= 6) return;
  buf[context] += digit;
  updatePinDots(context, buf[context].length);
  if (buf[context].length === 6) {
    if (context === 'set') handleSetPin();
    else handleUnlock();
  }
};

App.pinBackspace = function(context) {
  const buf = state.pinBuffer;
  if (buf[context].length === 0) return;
  buf[context] = buf[context].slice(0,-1);
  updatePinDots(context, buf[context].length);
};

async function handleSetPin() {
  const pin = state.pinBuffer.set;
  if (state.pinStage === 'first') {
    state.pinFirst = pin;
    state.pinBuffer.set = '';
    updatePinDots('set', 0);
    document.getElementById('set-pin-title').textContent = 'Conferma il PIN';
    document.getElementById('set-pin-desc').textContent = 'Reinserisci le 6 cifre per confermare.';
    state.pinStage = 'confirm';
    return;
  }
  // confirm stage
  if (pin !== state.pinFirst) {
    state.pinBuffer.set = ''; state.pinFirst = ''; state.pinStage = 'first';
    updatePinDots('set', 0);
    document.getElementById('set-pin-title').textContent = 'Crea il tuo PIN';
    document.getElementById('set-pin-desc').textContent = 'Scegli 6 numeri per aprire la tua app velocemente.';
    showError('pin-error-set', 'I PIN non corrispondono. Riprova.');
    return;
  }
  // PIN confirmed — encrypt mnemonic with PIN
  const pinSalt = randomSalt();
  localStorage.setItem(STORAGE.PIN_SALT, pinSalt);
  const pinKey = await deriveKeyFromString(pin, 'caveau-pin-' + pinSalt);
  const mnemonic = state.tempMnemonic;
  localStorage.setItem(STORAGE.SEED_ENC, await encrypt(pinKey, mnemonic));
  localStorage.setItem(STORAGE.ADDRESS, state.address);
  // derive vault key from mnemonic
  state.vaultKey = await deriveKeyFromString(mnemonic, 'caveau-vaults-v1-' + state.address);
  try {
    const wallet2 = ethers.Wallet.fromPhrase(mnemonic);
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
    state.walletSigner = wallet2.connect(provider);
  } catch { /* RPC non-critical */ }
  state.tempMnemonic = null;
  state.pinBuffer.set = ''; state.pinFirst = ''; state.pinStage = 'first';
  await saveVaults();
  showDashboard();
}

async function handleUnlock() {
  const pin = state.pinBuffer.unlock;
  const pinSalt = localStorage.getItem(STORAGE.PIN_SALT);
  const seedBlob = localStorage.getItem(STORAGE.SEED_ENC);
  const savedAddress = localStorage.getItem(STORAGE.ADDRESS);
  try {
    const pinKey = await deriveKeyFromString(pin, 'caveau-pin-' + pinSalt);
    const mnemonic = await decrypt(pinKey, seedBlob);
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    if (wallet.address.toLowerCase() !== savedAddress.toLowerCase()) throw new Error('mismatch');
    state.address = wallet.address;
    state.vaultKey = await deriveKeyFromString(mnemonic, 'caveau-vaults-v1-' + state.address);
    try {
      const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
      state.walletSigner = wallet.connect(provider);
    } catch { /* RPC non-critical */ }
    state.pinBuffer.unlock = '';
    updatePinDots('unlock', 0);
    await loadVaults();
    showDashboard();
  } catch {
    state.pinBuffer.unlock = '';
    updatePinDots('unlock', 0);
    showError('pin-error-unlock', 'PIN errato. Riprova.');
  }
}

// ─── Wallet creation ─────────────────────────────────────────
App.startCreateWallet = async function() {
  const wallet = ethers.Wallet.createRandom();
  state.tempMnemonic = wallet.mnemonic.phrase;
  state.address = wallet.address;
  renderSeedWordGrid(state.tempMnemonic, 'seed-words-grid');
  showScreen('screen-seed-create');
};

App.confirmSeedWritten = function() {
  // reset PIN state
  state.pinStage = 'first'; state.pinFirst = ''; state.pinBuffer.set = '';
  state.afterRestorePin = false;
  updatePinDots('set', 0);
  document.getElementById('set-pin-title').textContent = 'Crea il tuo PIN';
  document.getElementById('set-pin-desc').textContent = 'Scegli 6 numeri per aprire la tua app velocemente.';
  document.getElementById('pin-error-set').classList.add('hidden');
  showScreen('screen-set-pin');
};

App.copySeedCreate = function() {
  if (!state.tempMnemonic) return;
  navigator.clipboard.writeText(state.tempMnemonic);
  const btn = document.getElementById('copy-seed-create-btn');
  const orig = btn.textContent;
  btn.textContent = '✅ Copiata!';
  setTimeout(() => { btn.textContent = orig; }, 2000);
};

App.goBack = function() { showScreen('screen-welcome'); };

App.showRestoreWallet = function() {
  document.getElementById('restore-title').textContent = 'Recupera il tuo account';
  document.getElementById('restore-desc').textContent = 'Inserisci le 12 parole segrete che avevi salvato, nell\'ordine corretto.';
  renderRestoreInputs();
  showScreen('screen-seed-restore');
};

App.forgotPin = function() {
  document.getElementById('restore-title').textContent = 'Recupera con le parole segrete';
  document.getElementById('restore-desc').textContent = 'Inserisci le 12 parole per reimpostare il PIN.';
  state.afterRestorePin = true;
  renderRestoreInputs();
  showScreen('screen-seed-restore');
};

App.restoreWallet = async function() {
  const words = [...document.querySelectorAll('.restore-word')]
    .map(i => i.value.trim().toLowerCase()).filter(w => w);
  if (words.length !== 12) {
    showError('restore-error', 'Inserisci tutte e 12 le parole segrete.');
    return;
  }
  const mnemonic = words.join(' ');
  try {
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    state.tempMnemonic = mnemonic;
    state.address = wallet.address;
    // Try to load existing vaults from current storage if address matches
    const savedAddress = localStorage.getItem(STORAGE.ADDRESS);
    if (savedAddress && savedAddress.toLowerCase() === wallet.address.toLowerCase()) {
      state.vaultKey = await deriveKeyFromString(mnemonic, 'caveau-vaults-v1-' + state.address);
      await loadVaults();
    }
    // Proceed to set new PIN
    state.pinStage = 'first'; state.pinFirst = ''; state.pinBuffer.set = '';
    updatePinDots('set', 0);
    document.getElementById('set-pin-title').textContent = 'Imposta Nuovo PIN';
    document.getElementById('set-pin-desc').textContent = 'Scegli un nuovo PIN di 6 cifre.';
    document.getElementById('pin-error-set').classList.add('hidden');
    showScreen('screen-set-pin');
  } catch {
    showError('restore-error', 'Le parole non sono corrette. Controlla e riprova.');
  }
};

// ─── Dashboard ───────────────────────────────────────────────
function showDashboard() {
  showScreen('screen-dashboard');
  document.getElementById('settings-address').textContent = state.address;
  const link = document.getElementById('polygonscan-link');
  link.href = `https://polygonscan.com/address/${state.address}`;
  renderDashboard();
  checkVaultNotifications();
}

async function checkVaultNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') return;
  const notified = JSON.parse(localStorage.getItem('caveau_notified') || '{}');
  let changed = false;
  state.vaults.forEach(v => {
    if (isVaultUnlocked(v) && !notified[v.id]) {
      new Notification('\uD83D\uDD13 ' + v.icon + ' ' + v.name + ' è aperto!', {
        body: 'Il tuo salvadanaio è pronto! Puoi finalmente ritirare i soldi.',
        icon: '/icon-192.png', tag: 'vault-' + v.id
      });
      notified[v.id] = true;
      changed = true;
    }
  });
  if (changed) localStorage.setItem('caveau_notified', JSON.stringify(notified));
}

const _onramp = { amount: 0 };

App.openOnramp = function() {
  _onramp.amount = 0;
  document.getElementById('onramp-step1').classList.remove('hidden');
  document.getElementById('onramp-step2').classList.add('hidden');
  document.getElementById('onramp-subtitle').textContent = 'Scegli quanto vuoi aggiungere al tuo saldo.';
  document.getElementById('onramp-amount-input').value = '';
  document.querySelectorAll('.onramp-preset').forEach(b => b.classList.remove('bg-blue-600','border-blue-500'));
  document.getElementById('onramp-refresh-msg')?.classList.add('hidden');
  App.openModal('modal-onramp');
};

App.setOnrampAmount = function(val) {
  _onramp.amount = val;
  document.getElementById('onramp-amount-input').value = '';
  document.querySelectorAll('.onramp-preset').forEach(b => b.classList.remove('bg-blue-600','border-blue-500'));
  event.currentTarget.classList.add('bg-blue-600','border-blue-500');
};

App.setOnrampAmountCustom = function(val) {
  _onramp.amount = parseFloat(val) || 0;
  document.querySelectorAll('.onramp-preset').forEach(b => b.classList.remove('bg-blue-600','border-blue-500'));
};

App.onrampNext = function() {
  if (!_onramp.amount || _onramp.amount < 10) {
    document.getElementById('onramp-amount-input').focus();
    document.getElementById('onramp-amount-input').placeholder = 'Minimo 10€';
    return;
  }
  const addr = state.address || '';
  const amt = _onramp.amount;
  document.getElementById('onramp-address').textContent = addr;
  document.getElementById('onramp-copied').classList.add('hidden');
  document.getElementById('onramp-qr').src =
    `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(addr)}&margin=0`;
  const label = `→ ${amt}€`;
  ['onramp-label-mtpelerin','onramp-label-guardarian','onramp-label-moonpay']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = label; });
  document.getElementById('onramp-subtitle').textContent = `Aggiungi circa ${amt}€ al tuo saldo`;
  document.getElementById('onramp-step1').classList.add('hidden');
  document.getElementById('onramp-step2').classList.remove('hidden');
  document.getElementById('onramp-refresh-msg')?.classList.add('hidden');
};

App.onrampBack = function() {
  document.getElementById('onramp-step1').classList.remove('hidden');
  document.getElementById('onramp-step2').classList.add('hidden');
  document.getElementById('onramp-subtitle').textContent = 'Scegli quanto vuoi aggiungere al tuo saldo.';
};

App.refreshAfterOnramp = async function() {
  const msg = document.getElementById('onramp-refresh-msg');
  if (!msg) return;
  msg.classList.remove('hidden');
  msg.textContent = 'Controllo saldo in corso...';
  try {
    await renderDashboard();
    const hasFunds = state.vaults.some(v => vaultTotal(v) > 0);
    msg.textContent = hasFunds
      ? 'Perfetto! Sembra che i fondi siano arrivati.'
      : 'Se il saldo e ancora 0, aspetta qualche minuto e riprova.';
  } catch {
    msg.textContent = 'Non riesco a verificare ora. Riprova tra poco.';
  }
};

App.copyOnrampAddress = function() {
  navigator.clipboard.writeText(state.address || '');
  document.getElementById('onramp-copied').classList.remove('hidden');
  setTimeout(() => document.getElementById('onramp-copied').classList.add('hidden'), 2000);
};

App.openMtPelerin = function() {
  const url = new URL('https://widget.mtpelerin.com/');
  url.searchParams.set('_ctkn', 'bb3ca0be-83a5-42a7-8e4f-5cb08892caf2');
  url.searchParams.set('lang', 'it');
  url.searchParams.set('tab', 'buy');
  url.searchParams.set('bsc', 'EUR');
  url.searchParams.set('bdc', 'USDC');
  url.searchParams.set('dnet', 'matic_mainnet');
  if (_onramp.amount) url.searchParams.set('bsa', _onramp.amount);
  if (state.address) url.searchParams.set('addr', state.address);
  window.open(url.toString(), '_blank');
};

App.openGuardarian = function() {
  const url = new URL('https://guardarian.com/buy-crypto');
  url.searchParams.set('to_currency', 'USDC_MATIC');
  url.searchParams.set('from_currency', 'EUR');
  if (_onramp.amount) url.searchParams.set('from_amount', _onramp.amount);
  if (state.address) url.searchParams.set('to_wallet_address', state.address);
  window.open(url.toString(), '_blank');
};

App.openMoonpay = function() {
  const url = new URL('https://buy.moonpay.com/');
  url.searchParams.set('defaultCurrencyCode', 'usdc_polygon');
  if (_onramp.amount) url.searchParams.set('baseCurrencyAmount', _onramp.amount);
  if (state.address) url.searchParams.set('walletAddress', state.address);
  window.open(url.toString(), '_blank');
};

App.openTransak = function() {
  window.open('https://global.transak.com/', '_blank');
};

function renderDashboard() {
  const vaults = state.vaults;
  const total = vaults.reduce((s, v) => s + vaultTotal(v), 0);
  document.getElementById('stat-total').textContent = total.toFixed(2);
  document.getElementById('stat-vaults').textContent = vaults.length;
  const beginnerBanner = document.getElementById('beginner-start-banner');
  if (beginnerBanner) {
    if (total <= 0) beginnerBanner.classList.remove('hidden');
    else beginnerBanner.classList.add('hidden');
  }

  const locked = vaults.filter(v => !isVaultUnlocked(v));
  if (locked.length) {
    const withDate = locked.filter(v => v.unlockDate).sort((a,b) => new Date(a.unlockDate)-new Date(b.unlockDate));
    const next = withDate.length ? withDate[0] : locked[0];
    document.getElementById('stat-next-unlock').textContent = next.icon + ' ' + next.name;
    if (next.unlockDate) {
      const d = daysUntil(next.unlockDate);
      document.getElementById('stat-days-left').textContent = `${d} giorni`;
    } else {
      const remaining = Math.max(0, next.target - vaultTotal(next));
      document.getElementById('stat-days-left').textContent = `${remaining.toFixed(0)} ${next.currency} mancanti`;
    }
  } else if (vaults.length) {
    document.getElementById('stat-next-unlock').textContent = '🔓 Tutti aperti';
    document.getElementById('stat-days-left').textContent = '';
  } else {
    document.getElementById('stat-next-unlock').textContent = '—';
    document.getElementById('stat-days-left').textContent = 'nessun salvadanaio';
  }

  renderVaultCards();
  if (vaults.length > 0) {
    document.getElementById('chart-section').classList.remove('hidden');
    document.getElementById('empty-vaults').classList.add('hidden');
    renderDashChart();
  } else {
    document.getElementById('chart-section').classList.add('hidden');
    document.getElementById('empty-vaults').classList.remove('hidden');
  }
}

function renderVaultCards() {
  const grid = document.getElementById('vaults-grid');
  grid.querySelectorAll('.vault-card').forEach(c => c.remove());
  if (!state.vaults.length) {
    document.getElementById('empty-vaults').classList.remove('hidden');
    return;
  }
  document.getElementById('empty-vaults').classList.add('hidden');
  state.vaults.forEach(vault => {
    const total = vaultTotal(vault);
    const pct = vault.target ? Math.min((total / vault.target) * 100, 100) : 0;
    const unlocked = isVaultUnlocked(vault);
    const mode = vault.unlockMode ?? 0;
    let statusText = '';
    if (unlocked) {
      statusText = '🔓 Aperto!';
    } else if (mode === 0) {
      statusText = `🔒 ${daysUntil(vault.unlockDate)}g rimasti`;
    } else if (mode === 1) {
      const remaining = Math.max(0, vault.target - total);
      statusText = `🔒 Mancano ${remaining.toFixed(0)} ${vault.currency}`;
    } else {
      const d = vault.unlockDate ? daysUntil(vault.unlockDate) : Infinity;
      const remaining = vault.target ? Math.max(0, vault.target - total) : Infinity;
      statusText = `🔒 ${d < Infinity ? d+'g' : ''} ${d < Infinity && remaining > 0 ? '/ ' : ''}${remaining > 0 && remaining < Infinity ? remaining.toFixed(0)+' '+vault.currency : ''}`;
    }
    const bottomRight = vault.unlockDate ? fmtDate(vault.unlockDate) : (vault.target ? `Obiettivo: ${vault.target}` : '');
    const card = document.createElement('div');
    card.className = 'vault-card bg-slate-800 rounded-2xl p-5 border border-slate-700 cursor-pointer hover:border-slate-500';
    card.onclick = () => App.openVaultDetail(vault.id);
    card.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <span class="text-3xl">${vault.icon}</span>
          <div>
            <h3 class="font-semibold leading-tight">${vault.name}</h3>
            <span class="text-xs ${unlocked ? 'text-green-400':'text-blue-400'}">
              ${statusText}
            </span>
          </div>
        </div>
        <span class="text-xs text-slate-500 font-mono">${vault.currency}</span>
      </div>
      <div class="mb-3">
        <div class="flex justify-between text-xs mb-1.5">
          <span class="text-slate-300 font-medium">${total.toFixed(2)}</span>
          <span class="text-slate-400">${vault.target || '—'}</span>
        </div>
        <div class="w-full bg-slate-700 rounded-full h-2">
          <div class="h-2 rounded-full" style="width:${pct}%;background:${vault.color}"></div>
        </div>
      </div>
      <div class="flex justify-between text-xs text-slate-500">
        <span>${pct.toFixed(1)}% completato</span>
        <span>${bottomRight}</span>
      </div>`;
    grid.appendChild(card);
  });
}

// ─── Vault CRUD ──────────────────────────────────────────────
App.showNewVaultModal = function() {
  document.getElementById('vault-name').value = '';
  document.getElementById('vault-target').value = '';
  document.getElementById('vault-currency').value = 'USDC';
  document.getElementById('vault-date').value = '2027-11-30';
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  document.getElementById('vault-date').min = tomorrow.toISOString().split('T')[0];
  document.getElementById('vault-error').classList.add('hidden');
  state.selectedPreset = PRESETS[9];
  state.selectedUnlockMode = 0;
  App.setUnlockMode(0);
  renderIconPicker();
  openModal('modal-new-vault');
};

function renderIconPicker() {
  document.getElementById('icon-picker').innerHTML = PRESETS.map((p,i) => `
    <button onclick="App.selectPreset(${i})" title="${p.name}"
      class="flex flex-col items-center p-2 rounded-xl border-2 transition-all
      ${state.selectedPreset.icon===p.icon ? 'border-blue-500 bg-blue-500/15':'border-slate-700 hover:border-slate-500'}">
      <span class="text-2xl">${p.icon}</span>
      <span class="text-xs text-slate-400 mt-0.5 truncate w-full text-center">${p.name}</span>
    </button>`).join('');
  document.getElementById('vault-name').placeholder = `es. ${state.selectedPreset.name}`;
}

App.selectPreset = function(i) {
  state.selectedPreset = PRESETS[i];
  document.getElementById('vault-name').value = PRESETS[i].name;
  renderIconPicker();
};

App.createVault = async function() {
  const name = document.getElementById('vault-name').value.trim();
  const currency = document.getElementById('vault-currency').value;
  const mode = state.selectedUnlockMode;
  const needsDate   = mode === 0 || mode === 2 || mode === 3;
  const needsTarget = mode === 1 || mode === 2 || mode === 3;

  if (!name) return showError('vault-error','Inserisci un nome.');

  let target = 0;
  if (needsTarget) {
    target = parseFloat(document.getElementById('vault-target').value);
    if (!target || target <= 0) return showError('vault-error','Inserisci una cifra obiettivo valida.');
  }

  let unlockDate = null;
  if (needsDate) {
    unlockDate = document.getElementById('vault-date').value;
    if (!unlockDate) return showError('vault-error','Seleziona una data di sblocco.');
    if (new Date(unlockDate) <= new Date()) return showError('vault-error','La data deve essere nel futuro.');
  }

  const vault = {
    id: uid(), name,
    icon: state.selectedPreset.icon,
    color: state.selectedPreset.color,
    target, currency, unlockDate,
    unlockMode: mode,
    transactions: [],
    createdAt: new Date().toISOString()
  };
  state.vaults.push(vault);
  await saveVaults();
  closeModal('modal-new-vault');
  renderDashboard();
};

App.openVaultDetail = function(id) {
  state.currentVaultId = id;
  const vault = state.vaults.find(v => v.id === id);
  if (!vault) return;
  renderVaultDetail(vault);
  openModal('modal-vault-detail');
};

function renderVaultDetail(vault) {
  const total = vaultTotal(vault);
  const pct = vault.target ? Math.min((total / vault.target) * 100, 100) : 0;
  const mode = vault.unlockMode ?? 0;
  const unlocked = isVaultUnlocked(vault);

  document.getElementById('detail-title').textContent = vault.icon + ' ' + vault.name;
  document.getElementById('detail-amount').textContent = `${total.toFixed(2)} ${vault.currency}`;
  document.getElementById('detail-target').textContent = vault.target ? `${vault.target} ${vault.currency}` : '—';
  document.getElementById('detail-pct').textContent = `${pct.toFixed(1)}%`;
  const bar = document.getElementById('detail-progress-bar');
  bar.style.width = `${pct}%`; bar.style.background = vault.color;

  const countdown = document.getElementById('detail-countdown');
  if (unlocked) {
    countdown.textContent = '🔓 APERTO!';
    countdown.style.color = '#4ade80';
  } else {
    countdown.style.color = '#f1f5f9';
    if (mode === 0) {
      const d = daysUntil(vault.unlockDate);
      const mo = Math.floor(d/30), dd = d%30;
      countdown.textContent = mo > 0 ? `${mo} mesi e ${dd}g` : `${d} giorni`;
    } else if (mode === 1) {
      const remaining = Math.max(0, vault.target - total);
      countdown.textContent = `${remaining.toFixed(0)} ${vault.currency} da raggiungere`;
    } else {
      countdown.textContent = '🔒 BLOCCATO';
    }
  }

  const condEl = document.getElementById('detail-conditions');
  let condHTML = '';
  const hasDate = mode === 0 || mode === 2 || mode === 3;
  const hasAmount = mode === 1 || mode === 2 || mode === 3;
  const dateMet = vault.unlockDate ? daysUntil(vault.unlockDate) <= 0 : false;
  const amountMet = vault.target ? total >= vault.target : false;
  const connector = mode === 2 ? 'OPPURE' : (mode === 3 ? 'E' : '');

  if (hasDate) {
    const icon = dateMet ? '✅' : '⏳';
    const d = daysUntil(vault.unlockDate);
    const txt = dateMet ? `Data raggiunta (${fmtDate(vault.unlockDate)})` : `${fmtDate(vault.unlockDate)} — ${d} giorni`;
    condHTML += `<div class="flex items-center gap-2 ${dateMet ? 'text-green-400' : 'text-slate-300'}">${icon} <span>${txt}</span></div>`;
  }
  if (connector) {
    condHTML += `<div class="text-center text-xs text-slate-500 font-semibold">${connector}</div>`;
  }
  if (hasAmount) {
    const icon = amountMet ? '✅' : '💰';
    const txt = amountMet ? `Obiettivo raggiunto (${total.toFixed(2)}/${vault.target})` : `${total.toFixed(2)} / ${vault.target} ${vault.currency}`;
    condHTML += `<div class="flex items-center gap-2 ${amountMet ? 'text-green-400' : 'text-slate-300'}">${icon} <span>${txt}</span></div>`;
  }
  condEl.innerHTML = condHTML;

  const unlockDateEl = document.getElementById('detail-unlock-date');
  unlockDateEl.textContent = unlockModeLabel(mode);

  const panicDateEl = document.getElementById('panic-date');
  if (vault.unlockDate) {
    panicDateEl.textContent = `Torna il ${fmtDate(vault.unlockDate)}.`;
  } else {
    panicDateEl.textContent = `Raggiungi ${vault.target} ${vault.currency} per sbloccare.`;
  }

  renderTxList(vault);
  renderVaultChart(vault);

  // ── Setup payment method chips ──
  const vaultCur = vault.currency;
  const currencyNames = { USDC: 'Dollari', EURC: 'Euro', DAI: 'Dollari', USDT: 'Dollari' };
  const directLabel = document.getElementById('pay-direct-label');
  if (directLabel) directLabel.textContent = currencyNames[vaultCur] || vaultCur;
  const autoDest = document.getElementById('pay-auto-dest');
  if (autoDest) autoDest.textContent = (currencyNames[vaultCur] || vaultCur).toLowerCase() + ' digitali';

  // Populate "more" grid: remaining cross-chain coins + on-chain wallet tokens
  const moreGrid = document.getElementById('pay-more-grid');
  if (moreGrid) {
    const extraCC = CROSS_CHAINS.filter(c => c.symbol !== 'BTC' && c.symbol !== 'ETH');
    const walletTokens = SWAP_TOKENS.filter(t => t.symbol !== 'MATIC');
    let html = extraCC.map(c =>
      `<button onclick="App.selectPayMethod('cc:${c.symbol}')" class="pay-chip flex flex-col items-center gap-0.5 bg-slate-800 border-2 border-slate-700 hover:border-blue-500/50 rounded-xl py-2 px-1 text-center transition-all">
        <span class="text-sm">${c.icon}</span>
        <span class="text-[10px] font-medium text-slate-300">${c.label}</span>
      </button>`).join('');
    if (walletTokens.length) {
      html += walletTokens.map(t =>
        `<button onclick="App.selectPayMethod('swap:${t.symbol}')" class="pay-chip flex flex-col items-center gap-0.5 bg-slate-800 border-2 border-slate-700 hover:border-blue-500/50 rounded-xl py-2 px-1 text-center transition-all">
          <span class="text-sm">🪙</span>
          <span class="text-[10px] font-medium text-slate-300">${t.symbol}</span>
        </button>`).join('');
    }
    moreGrid.innerHTML = html;
  }

  // Populate hidden source token dropdown (for on-chain swap logic)
  const srcSelect = document.getElementById('deposit-src-token');
  if (srcSelect) {
    srcSelect.innerHTML = `<option value="native">${vaultCur}</option>` +
      SWAP_TOKENS.filter(t => t.symbol !== vaultCur)
        .map(t => `<option value="${t.symbol}">${t.symbol}</option>`).join('');
    srcSelect.value = 'native';
  }

  // Reset payment state
  state._payMethod = 'direct';
  state._crossChainCoin = null;
  document.getElementById('swap-quote-box')?.classList.add('hidden');
  document.getElementById('pay-auto-info')?.classList.add('hidden');
  document.getElementById('pay-more-grid')?.classList.add('hidden');
  document.getElementById('deposit-lock-btn').textContent = '🔒 Blocca nel salvadanaio';
  App._resetPayChips();
  // Highlight default "direct" chip
  const directChip = document.getElementById('pay-direct');
  if (directChip) {
    directChip.classList.remove('bg-slate-800', 'border-slate-700');
    directChip.classList.add('active', 'bg-blue-600/20', 'border-blue-500');
    const lbl = directChip.querySelector('span:last-child');
    if (lbl) lbl.classList.replace('text-slate-300', 'text-white');
  }

  // Debounce swap preview on amount input
  const amtInput = document.getElementById('deposit-amount');
  if (amtInput) {
    amtInput.oninput = () => {
      if (state._payMethod === 'swap') App.fetchSwapPreview();
    };
  }
  // Check MATIC balance for gas warning
  if (state.address) checkAndShowMaticWarning();
}

function renderTxList(vault) {
  const el = document.getElementById('detail-transactions');
  if (!vault.transactions.length) {
    el.innerHTML = '<p class="text-slate-500 text-sm text-center py-3">Nessun versamento ancora</p>';
    return;
  }
  el.innerHTML = [...vault.transactions].reverse().map(tx => {
    const hashShort = tx.txHash.slice(0,10) + '\u2026' + tx.txHash.slice(-6);
    const isPolygonTx = tx.onChain && tx.txHash.startsWith('0x');
    const badge = isPolygonTx
      ? `<a href="https://polygonscan.com/tx/${tx.txHash}" target="_blank" class="text-xs font-mono text-blue-400 hover:text-blue-300 underline mt-0.5 block">${hashShort} \u2197</a>`
      : `<p class="text-xs text-slate-600 font-mono mt-0.5">${hashShort} <span class="text-slate-700">(${tx.crossChain ? 'cross-chain' : 'locale'})</span></p>`;
    const icon = tx.crossChain ? '\uD83C\uDF10' : (tx.onChain ? '\uD83D\uDD12' : '\uD83D\uDCDD');
    const swapNote = tx.swappedFrom ? `<span class="text-xs text-purple-400 ml-1">(da ${tx.swappedFrom})</span>` : '';
    const ccNote = tx.crossChain ? `<span class="text-xs text-purple-400 ml-1">(cross-chain)</span>` : '';
    return `
    <div class="bg-slate-800 rounded-xl px-4 py-3 flex justify-between items-center">
      <div>
        <p class="text-sm font-semibold">${icon} +${tx.amount} ${vault.currency}${swapNote}${ccNote}</p>
        ${badge}
      </div>
      <span class="text-xs text-slate-400">${fmtDateShort(tx.date.split('T')[0])}</span>
    </div>`;
  }).join('');
}

App.addDeposit = async function() {
  const amount = parseFloat(document.getElementById('deposit-amount').value);
  if (!amount || amount <= 0) return;
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  vault.transactions.push({ id: uid(), date: new Date().toISOString(), amount, txHash: fakeHash() });
  await saveVaults();
  document.getElementById('deposit-amount').value = '';
  renderVaultDetail(vault);
  renderDashboard();
  openModal('modal-vault-detail');
};

// ─── Charts ──────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#64748b', maxTicksLimit: 7 }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }
  }
};

function renderDashChart() {
  const ctx = document.getElementById('main-chart').getContext('2d');
  if (state.dashChart) state.dashChart.destroy();
  const txs = state.vaults
    .flatMap(v => v.transactions.map(t => ({ date: t.date.split('T')[0], amount: t.amount })))
    .sort((a,b) => a.date.localeCompare(b.date));
  if (!txs.length) return;
  let running = 0;
  const labels = [], data = [];
  txs.forEach(t => { running += t.amount; labels.push(fmtDateShort(t.date)); data.push(+running.toFixed(2)); });
  state.dashChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 2, pointRadius: 3, fill: true }] },
    options: CHART_DEFAULTS
  });
}

function renderVaultChart(vault) {
  const ctx = document.getElementById('vault-chart').getContext('2d');
  if (state.vaultChart) state.vaultChart.destroy();
  const { labels, actual, ideal } = buildVaultChartData(vault);
  state.vaultChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Ideale', data: ideal, borderColor: 'rgba(100,116,139,.5)', borderDash: [5,5], borderWidth: 1.5, pointRadius: 0, fill: false },
        { label: 'Reale',  data: actual, borderColor: vault.color, backgroundColor: vault.color+'20', borderWidth: 2, pointRadius: 3, fill: true }
      ]
    },
    options: CHART_DEFAULTS
  });
}

function buildVaultChartData(vault) {
  const start = new Date(vault.createdAt);
  const end   = vault.unlockDate ? new Date(vault.unlockDate) : new Date(start.getTime() + 365*86400000);
  const today = new Date();
  const months = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end && cur <= today) {
    months.push(cur.toISOString().slice(0,7));
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
  }
  const todayM = today.toISOString().slice(0,7);
  if (!months.includes(todayM)) months.push(todayM);

  const totalMonths = Math.max(1, Math.round((end-start)/(1000*60*60*24*30)));
  const perMonth = vault.target / totalMonths;
  const ideal = months.map((_,i) => +((i+1)*perMonth).toFixed(2));

  const txByMonth = {};
  vault.transactions.forEach(t => {
    const m = t.date.slice(0,7);
    txByMonth[m] = (txByMonth[m]||0) + t.amount;
  });
  let running = 0;
  const actual = months.map(m => { running += txByMonth[m]||0; return +running.toFixed(2); });

  return { labels: months, actual, ideal };
}

// ─── Settings ────────────────────────────────────────────────
App.showSettings = function() { openModal('modal-settings'); };

App.showSeedPhrase = function() {
  const blob = localStorage.getItem(STORAGE.SEED_ENC);
  if (!blob) return;
  state.pinVerifyBuffer = '';
  updatePinDotsVerify(0);
  document.getElementById('pin-verify-error').classList.add('hidden');
  state.pinVerifyCallback = async (pin) => {
    const salt = localStorage.getItem(STORAGE.PIN_SALT);
    try {
      const pinKey = await deriveKeyFromString(pin, 'caveau-pin-' + salt);
      const mnemonic = await decrypt(pinKey, blob);
      renderSeedWordGrid(mnemonic, 'show-seed-grid');
      App.closeModal('modal-pin-verify');
      App.closeModal('modal-settings');
      App.openModal('modal-show-seed');
    } catch {
      state.pinVerifyBuffer = '';
      updatePinDotsVerify(0);
      showError('pin-verify-error', 'PIN errato. Riprova.');
    }
  };
  App.openModal('modal-pin-verify');
};

App.copySeedPhrase = function() {
  const words = [...document.querySelectorAll('#show-seed-grid .sw-text')].map(e => e.textContent).join(' ');
  navigator.clipboard.writeText(words).then(() => alert('Copiato! Cancella subito dagli appunti dopo averla salvata.'));
};

App.copyDonationAddress = function() {
  navigator.clipboard.writeText(DONATION_ADDRESS);
  document.getElementById('donation-copied').classList.remove('hidden');
  setTimeout(() => document.getElementById('donation-copied').classList.add('hidden'), 3000);
};

App.confirmDeleteWallet = function() {
  if (!confirm('SEI SICURO? Tutti i dati saranno rimossi da questo dispositivo. Assicurati di aver salvato le 12 parole segrete!')) return;
  [STORAGE.ADDRESS, STORAGE.SEED_ENC, STORAGE.VAULTS_ENC, STORAGE.PIN_SALT].forEach(k => localStorage.removeItem(k));
  Object.assign(state, { address: null, vaultKey: null, vaults: [], currentVaultId: null });
  closeModal('modal-settings');
  showScreen('screen-welcome');
};

App.panicButton = function() {
  closeModal('modal-vault-detail');
  openModal('modal-panic');
};

// ─── PIN Verify Modal ────────────────────────────────────────
function updatePinDotsVerify(len) {
  document.querySelectorAll('#pin-dots-verify .pin-dot').forEach((d, i) => {
    d.classList.toggle('filled', i < len);
  });
}

App.pinVerifyKeyPress = function(digit) {
  if (state.pinVerifyBuffer.length >= 6) return;
  state.pinVerifyBuffer += digit;
  updatePinDotsVerify(state.pinVerifyBuffer.length);
  if (state.pinVerifyBuffer.length === 6) state.pinVerifyCallback?.(state.pinVerifyBuffer);
};

App.pinVerifyBackspace = function() {
  state.pinVerifyBuffer = state.pinVerifyBuffer.slice(0, -1);
  updatePinDotsVerify(state.pinVerifyBuffer.length);
};

// ─── Blockchain / CaveauDigitale ─────────────────────────────
async function getTokenBalance(address, currency) {
  let tokenAddr = TOKEN_ADDRESSES[currency];
  let decimals  = TOKEN_DECIMALS[currency] || 6;
  if (!tokenAddr) {
    const swapTok = SWAP_TOKENS.find(t => t.symbol === currency);
    if (!swapTok || swapTok.address === NATIVE_TOKEN) return null;
    tokenAddr = swapTok.address;
    decimals  = swapTok.decimals;
  }
  try {
    const provider = state.walletSigner?.provider || new ethers.JsonRpcProvider(POLYGON_RPC);
    const contract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
    const raw = await contract.balanceOf(address);
    return Number(ethers.formatUnits(raw, decimals));
  } catch { return null; }
}

App.showCaveauLock = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;

  // Cross-chain: route to SideShift modal (no amount needed upfront)
  if (state._payMethod === 'crosschain' && state._crossChainCoin) {
    const ccIdx = CROSS_CHAINS.findIndex(c => c.symbol === state._crossChainCoin.symbol);
    if (ccIdx >= 0) {
      App.openCrossChainModal();
      App.selectCrossChainCoin(ccIdx);
      return;
    }
  }

  const amount = parseFloat(document.getElementById('deposit-amount').value);
  if (!amount || amount <= 0) { showError('deposit-error', 'Inserisci un importo valido.'); return; }
  state.currentLockAmount = amount;

  const srcSel = document.getElementById('deposit-src-token').value;
  state._swapMode = srcSel !== 'native';
  state._swapSrcSymbol = srcSel;

  const mode = vault.unlockMode ?? 0;
  const displayCurrency = state._swapMode ? srcSel : vault.currency;
  document.getElementById('lock-vault-name').textContent = vault.icon + ' ' + vault.name;
  document.getElementById('lock-amount').textContent    = amount + ' ' + displayCurrency;
  document.getElementById('lock-mode').textContent      = unlockModeLabel(mode);
  document.getElementById('lock-address').textContent   = state.address.slice(0,8) + '…' + state.address.slice(-6);

  const dateRow = document.getElementById('lock-date-row');
  const targetRow = document.getElementById('lock-target-row');
  if (vault.unlockDate) {
    document.getElementById('lock-date').textContent = fmtDate(vault.unlockDate);
    dateRow.classList.remove('hidden');
  } else {
    dateRow.classList.add('hidden');
  }
  if (vault.target) {
    document.getElementById('lock-target').textContent = `${vault.target} ${vault.currency}`;
    targetRow.classList.remove('hidden');
  } else {
    targetRow.classList.add('hidden');
  }

  document.getElementById('lock-balance').textContent   = 'Caricamento...';
  document.getElementById('lock-balance').className     = 'text-slate-400 text-sm';
  document.getElementById('lock-status').textContent    = '';
  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = false;
  if (state._swapMode) {
    btn.textContent = '💱 Converti e Blocca';
    btn.onclick = () => App.executeSwapAndLock();
  } else {
    btn.textContent = '🔒 Blocca i soldi';
    btn.onclick = () => App.executeCaveauLock();
  }

  App.closeModal('modal-vault-detail');
  App.openModal('modal-caveau-lock');

  if (state._swapMode) {
    const srcToken = SWAP_TOKENS.find(t => t.symbol === state._swapSrcSymbol);
    if (srcToken && srcToken.address === NATIVE_TOKEN) {
      const maticBal = await getMaticBalance();
      const balEl = document.getElementById('lock-balance');
      if (maticBal !== null) {
        balEl.textContent = `Disponibile: ${maticBal.toFixed(4)} MATIC`;
        balEl.className = maticBal >= amount ? 'text-green-400 text-sm' : 'text-red-400 text-sm';
      }
    } else if (srcToken) {
      const srcBal = await getTokenBalance(state.address, state._swapSrcSymbol);
      const balEl = document.getElementById('lock-balance');
      if (srcBal !== null) {
        balEl.textContent = `Disponibile: ${srcBal.toFixed(4)} ${state._swapSrcSymbol}`;
        balEl.className = srcBal >= amount ? 'text-green-400 text-sm' : 'text-red-400 text-sm';
      } else {
        balEl.textContent = 'Saldo non disponibile';
      }
    }
  } else {
    const bal = await getTokenBalance(state.address, vault.currency);
    const balEl = document.getElementById('lock-balance');
    if (bal !== null) {
      balEl.textContent = `Disponibile: ${bal.toFixed(2)} ${vault.currency}`;
      balEl.className   = bal >= amount ? 'text-green-400 text-sm' : 'text-red-400 text-sm';
    } else {
      balEl.textContent = 'Saldo non disponibile (controlla connessione)';
    }
  }
};

App.executeCaveauLock = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  if (!state.walletSigner) {
    showLockStatus('error', '❌ Non sei connesso. Riapri l\'app e riprova.');
    return;
  }
  const amount      = state.currentLockAmount;
  const tokenAddr   = TOKEN_ADDRESSES[vault.currency];
  if (!tokenAddr) { showLockStatus('error', '❌ Token non supportato su Polygon.'); return; }
  const decimals    = TOKEN_DECIMALS[vault.currency] || 6;
  const amountUnits = ethers.parseUnits(amount.toString(), decimals);

  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = true;

  try {
    const caveau = new ethers.Contract(CAVEAU_CONTRACT, CAVEAU_ABI, state.walletSigner);
    const token  = new ethers.Contract(tokenAddr, ERC20_ABI, state.walletSigner);

    // Step 1: Create on-chain vault if first deposit
    if (!vault.onChainVaultId && vault.onChainVaultId !== 0) {
      const mode = vault.unlockMode ?? 0;
      const targetUnits = vault.target ? ethers.parseUnits(vault.target.toString(), decimals) : 0n;
      const unlockTs = vault.unlockDate
        ? Math.floor(new Date(vault.unlockDate + 'T00:00:00').getTime() / 1000)
        : 0;
      showLockStatus('pending', '1/3 — Preparazione del salvadanaio...');
      const createTx = await caveau.createVault(tokenAddr, targetUnits, unlockTs, mode);
      showLockStatus('pending', '1/3 — Attendi la conferma...');
      const createReceipt = await createTx.wait();
      const createLog = createReceipt.logs.find(l => {
        try { return caveau.interface.parseLog(l)?.name === 'VaultCreated'; } catch { return false; }
      });
      if (createLog) {
        vault.onChainVaultId = Number(caveau.interface.parseLog(createLog).args.vaultId);
      } else {
        const nextId = await caveau.nextVaultId();
        vault.onChainVaultId = Number(nextId) - 1;
      }
      await saveVaults();
    }

    // Step 2: Approve token
    showLockStatus('pending', '2/3 — Autorizzazione in corso...');
    const approveTx = await token.approve(CAVEAU_CONTRACT, amountUnits);
    showLockStatus('pending', '2/3 — Attendi la conferma...');
    await approveTx.wait();

    // Step 3: Deposit into on-chain vault
    showLockStatus('pending', '3/3 — Blocco dei soldi in corso...');
    const depositTx = await caveau.deposit(vault.onChainVaultId, amountUnits);
    showLockStatus('pending', '3/3 — Quasi fatto...');
    const receipt = await depositTx.wait();

    vault.transactions.push({
      id: uid(), date: new Date().toISOString(), amount,
      txHash: receipt.hash, onChain: true
    });
    await saveVaults();
    document.getElementById('deposit-amount').value = '';
    showLockStatus('success', `✅ Soldi bloccati con successo!`);
    btn.textContent = '✅ Fatto!';
    setTimeout(() => { App.closeModal('modal-caveau-lock'); renderVaultDetail(vault); renderDashboard(); App.openModal('modal-vault-detail'); }, 2500);
  } catch(err) {
    btn.disabled = false; btn.textContent = '🔒 Riprova';
    showLockStatus('error', '❌ ' + (err.reason || err.shortMessage || err.message || 'Errore').slice(0, 120));
  }
};

function showLockStatus(type, msg) {
  const el = document.getElementById('lock-status');
  const colors = { pending: 'text-yellow-400', success: 'text-green-400', error: 'text-red-400' };
  el.className   = `text-sm mt-3 ${colors[type] || 'text-slate-400'}`;
  el.textContent = msg;
}

// ─── FASE 2a: Auto-Swap (Paraswap) ─────────────────────────
async function getSwapQuote(srcAddr, destAddr, srcAmount, srcDec, destDec) {
  const url = `${PARASWAP_API}/prices?srcToken=${srcAddr}&destToken=${destAddr}&amount=${srcAmount}&srcDecimals=${srcDec}&destDecimals=${destDec}&side=SELL&network=137`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Quote non disponibile');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.priceRoute;
}

async function buildSwapTx(priceRoute, userAddress) {
  const res = await fetch(`${PARASWAP_API}/transactions/137`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      srcToken: priceRoute.srcToken, destToken: priceRoute.destToken,
      srcAmount: priceRoute.srcAmount, destAmount: priceRoute.destAmount,
      priceRoute, userAddress, partner: 'caveau-digitale', slippage: 100,
    }),
  });
  if (!res.ok) throw new Error('Errore costruzione swap TX');
  return await res.json();
}

// ─── Payment Method Chip Selector ────────────────────────────
App._resetPayChips = function() {
  document.querySelectorAll('.pay-chip').forEach(el => {
    el.classList.remove('active', 'bg-blue-600/20', 'border-blue-500');
    el.classList.add('bg-slate-800', 'border-slate-700');
    const label = el.querySelector('span:last-child');
    if (label) label.classList.replace('text-white', 'text-slate-300');
  });
};

App.selectPayMethod = function(method) {
  // Reset all chips visually
  App._resetPayChips();

  // Find and highlight the clicked chip
  const chipMap = { direct: 'pay-direct', btc: 'pay-btc', eth: 'pay-eth' };
  const chipEl = chipMap[method] ? document.getElementById(chipMap[method]) : 
    document.querySelector(`[onclick*="'${method}'"]`);
  if (chipEl) {
    chipEl.classList.remove('bg-slate-800', 'border-slate-700');
    chipEl.classList.add('active', 'bg-blue-600/20', 'border-blue-500');
    const label = chipEl.querySelector('span:last-child');
    if (label) label.classList.replace('text-slate-300', 'text-white');
  }

  const autoInfo = document.getElementById('pay-auto-info');
  const quoteBox = document.getElementById('swap-quote-box');
  const lockBtn = document.getElementById('deposit-lock-btn');
  const srcSelect = document.getElementById('deposit-src-token');

  // Determine method type
  if (method === 'direct') {
    // Direct stablecoin deposit
    state._payMethod = 'direct';
    state._crossChainCoin = null;
    srcSelect.value = 'native';
    autoInfo.classList.add('hidden');
    quoteBox.classList.add('hidden');
    lockBtn.textContent = '🔒 Blocca nel salvadanaio';

  } else if (method === 'btc' || method === 'eth') {
    // Cross-chain: BTC or ETH (main chips)
    const ccCoin = CROSS_CHAINS.find(c => c.symbol === method.toUpperCase());
    state._payMethod = 'crosschain';
    state._crossChainCoin = ccCoin;
    srcSelect.value = 'native';
    autoInfo.classList.remove('hidden');
    quoteBox.classList.add('hidden');
    lockBtn.textContent = `📩 Deposita con ${ccCoin.label}`;

  } else if (method.startsWith('cc:')) {
    // Cross-chain: other coins (from "more" grid)
    const symbol = method.split(':')[1];
    const ccCoin = CROSS_CHAINS.find(c => c.symbol === symbol);
    state._payMethod = 'crosschain';
    state._crossChainCoin = ccCoin;
    srcSelect.value = 'native';
    autoInfo.classList.remove('hidden');
    quoteBox.classList.add('hidden');
    lockBtn.textContent = `📩 Deposita con ${ccCoin.label}`;

  } else if (method.startsWith('swap:')) {
    // On-chain swap: wallet tokens (WETH, WBTC, etc.)
    const symbol = method.split(':')[1];
    state._payMethod = 'swap';
    state._crossChainCoin = null;
    srcSelect.value = symbol;
    autoInfo.classList.remove('hidden');
    quoteBox.classList.remove('hidden');
    lockBtn.textContent = '💱 Converti e Blocca';
    App.fetchSwapPreview();
  }
};

App.toggleMorePayMethods = function() {
  const grid = document.getElementById('pay-more-grid');
  const btn = document.getElementById('pay-more-btn');
  if (grid.classList.contains('hidden')) {
    grid.classList.remove('hidden');
    btn.textContent = 'Meno valute ▴';
  } else {
    grid.classList.add('hidden');
    btn.textContent = 'Altre valute ▾';
  }
};

App.onSrcTokenChange = function() {
  const sel = document.getElementById('deposit-src-token').value;
  const quoteBox = document.getElementById('swap-quote-box');
  if (sel === 'native') {
    quoteBox.classList.add('hidden');
    document.getElementById('deposit-lock-btn').textContent = '🔒 Blocca';
  } else {
    quoteBox.classList.remove('hidden');
    document.getElementById('deposit-lock-btn').textContent = '💱 Converti e Blocca';
    App.fetchSwapPreview();
  }
};

App.fetchSwapPreview = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const srcSymbol = document.getElementById('deposit-src-token').value;
  const amount = parseFloat(document.getElementById('deposit-amount').value);
  if (!amount || amount <= 0) return;
  const srcToken = SWAP_TOKENS.find(t => t.symbol === srcSymbol);
  if (!srcToken) return;
  const destAddr = TOKEN_ADDRESSES[vault.currency];
  const destDec  = TOKEN_DECIMALS[vault.currency] || 6;
  const srcAmountRaw = ethers.parseUnits(amount.toString(), srcToken.decimals).toString();
  try {
    const route = await getSwapQuote(srcToken.address, destAddr, srcAmountRaw, srcToken.decimals, destDec);
    const destAmt = Number(ethers.formatUnits(route.destAmount, destDec));
    document.getElementById('swap-dest-amount').textContent = destAmt.toFixed(2);
    document.getElementById('swap-dest-symbol').textContent = vault.currency;
    state._lastSwapRoute = route;
  } catch {
    document.getElementById('swap-dest-amount').textContent = '—';
    state._lastSwapRoute = null;
  }
};

App.executeSwapAndLock = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault || !state.walletSigner) { showLockStatus('error','❌ Non sei connesso. Riapri l\'app.'); return; }
  const srcSymbol = document.getElementById('deposit-src-token').value;
  const amount = state.currentLockAmount;
  const srcToken = SWAP_TOKENS.find(t => t.symbol === srcSymbol);
  if (!srcToken) { showLockStatus('error','❌ Token sorgente non trovato.'); return; }
  const destAddr = TOKEN_ADDRESSES[vault.currency];
  const destDec  = TOKEN_DECIMALS[vault.currency] || 6;
  const srcAmountRaw = ethers.parseUnits(amount.toString(), srcToken.decimals).toString();
  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = true;

  try {
    // Step 1: Get fresh quote
    showLockStatus('pending', '1/4 — Calcolo conversione...');
    const route = await getSwapQuote(srcToken.address, destAddr, srcAmountRaw, srcToken.decimals, destDec);
    const swapTxData = await buildSwapTx(route, state.address);

    // Step 2: Approve source token (skip for native MATIC)
    if (srcToken.address !== NATIVE_TOKEN) {
      showLockStatus('pending', '2/4 — Autorizzazione in corso...');
      const token = new ethers.Contract(srcToken.address, ERC20_ABI, state.walletSigner);
      const approveTx = await token.approve(swapTxData.to, srcAmountRaw);
      await approveTx.wait();
    }

    // Step 3: Execute swap
    showLockStatus('pending', '3/4 — Conversione in corso...');
    const txParams = {
      to: swapTxData.to, data: swapTxData.data,
      value: swapTxData.value || '0', gasLimit: swapTxData.gas || 500000n,
    };
    const swapTx = await state.walletSigner.sendTransaction(txParams);
    await swapTx.wait();
    const destAmount = Number(ethers.formatUnits(route.destAmount, destDec));

    // Step 4: Now deposit the swapped tokens into Caveau
    showLockStatus('pending', '4/4 — Blocco dei soldi...');
    const caveau = new ethers.Contract(CAVEAU_CONTRACT, CAVEAU_ABI, state.walletSigner);
    const destToken = new ethers.Contract(destAddr, ERC20_ABI, state.walletSigner);

    if (!vault.onChainVaultId && vault.onChainVaultId !== 0) {
      const mode = vault.unlockMode ?? 0;
      const targetUnits = vault.target ? ethers.parseUnits(vault.target.toString(), destDec) : 0n;
      const unlockTs = vault.unlockDate ? Math.floor(new Date(vault.unlockDate + 'T00:00:00').getTime() / 1000) : 0;
      const createTx = await caveau.createVault(destAddr, targetUnits, unlockTs, mode);
      const createReceipt = await createTx.wait();
      const createLog = createReceipt.logs.find(l => { try { return caveau.interface.parseLog(l)?.name === 'VaultCreated'; } catch { return false; } });
      vault.onChainVaultId = createLog ? Number(caveau.interface.parseLog(createLog).args.vaultId) : Number(await caveau.nextVaultId()) - 1;
      await saveVaults();
    }

    const depositUnits = ethers.parseUnits(destAmount.toFixed(destDec), destDec);
    const approveCaveauTx = await destToken.approve(CAVEAU_CONTRACT, depositUnits);
    await approveCaveauTx.wait();
    const depTx = await caveau.deposit(vault.onChainVaultId, depositUnits);
    const receipt = await depTx.wait();

    vault.transactions.push({ id: uid(), date: new Date().toISOString(), amount: destAmount, txHash: receipt.hash, onChain: true, swappedFrom: srcSymbol });
    await saveVaults();
    document.getElementById('deposit-amount').value = '';
    showLockStatus('success', `✅ Convertito e bloccato! ${amount} ${srcSymbol} → ${destAmount.toFixed(2)} ${vault.currency}`);
    btn.textContent = '✅ Fatto!';
    setTimeout(() => { App.closeModal('modal-caveau-lock'); renderVaultDetail(vault); renderDashboard(); App.openModal('modal-vault-detail'); }, 2500);
  } catch(err) {
    btn.disabled = false; btn.textContent = '🔒 Riprova';
    showLockStatus('error', '❌ ' + (err.reason || err.shortMessage || err.message || 'Errore').slice(0, 140));
  }
};

// ─── FASE 2b: Cross-Chain Deposits (SideShift) ──────────────
let ccPollInterval = null;

App.openCrossChainModal = function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  document.getElementById('cc-dest-currency').textContent = vault.currency;
  document.getElementById('cc-step-select').classList.remove('hidden');
  document.getElementById('cc-step-address').classList.add('hidden');
  const grid = document.getElementById('cc-coin-grid');
  grid.innerHTML = CROSS_CHAINS.map((c,i) => `
    <button onclick="App.selectCrossChainCoin(${i})"
      class="bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl p-3 text-center transition-colors">
      <span class="text-lg block">${c.symbol}</span>
      <span class="text-xs text-slate-400">${c.label}</span>
    </button>`).join('');
  App.closeModal('modal-vault-detail');
  App.openModal('modal-crosschain');
};

App.selectCrossChainCoin = async function(idx) {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault || !state.address) return;
  const coin = CROSS_CHAINS[idx];
  const settle = SETTLE_METHODS[vault.currency] || 'usdcpolygon';
  document.getElementById('cc-send-coin').textContent = coin.label;
  document.getElementById('cc-receive-coin').textContent = vault.currency + ' (Polygon)';
  document.getElementById('cc-deposit-address').textContent = 'Creazione in corso...';
  document.getElementById('cc-status').textContent = '⏳ Creazione ordine...';
  document.getElementById('cc-status').className = 'text-sm font-medium text-yellow-400';
  document.getElementById('cc-step-select').classList.add('hidden');
  document.getElementById('cc-step-address').classList.remove('hidden');

  try {
    const res = await fetch(`${SIDESHIFT_API}/shifts/variable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settleAddress: state.address,
        depositMethodId: coin.method,
        settleMethodId: settle,
      }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Errore SideShift'); }
    const shift = await res.json();
    document.getElementById('cc-deposit-address').textContent = shift.depositAddress;
    const limTxt = shift.depositMin ? `Min: ${shift.depositMin} ${coin.symbol}` : '';
    const limMax = shift.depositMax ? ` · Max: ${shift.depositMax} ${coin.symbol}` : '';
    document.getElementById('cc-limits').textContent = limTxt + limMax;
    document.getElementById('cc-status').textContent = '⏳ In attesa del deposito...';
    state._currentShiftId = shift.id;
    ccPollInterval = setInterval(() => App.pollShiftStatus(shift.id, vault), 10000);
  } catch(err) {
    document.getElementById('cc-deposit-address').textContent = '—';
    document.getElementById('cc-status').textContent = '❌ ' + (err.message || 'Errore').slice(0, 100);
    document.getElementById('cc-status').className = 'text-sm font-medium text-red-400';
  }
};

App.pollShiftStatus = async function(shiftId, vault) {
  try {
    const res = await fetch(`${SIDESHIFT_API}/shifts/${shiftId}`);
    if (!res.ok) return;
    const shift = await res.json();
    const statusEl = document.getElementById('cc-status');
    if (shift.status === 'waiting') {
      statusEl.textContent = '⏳ In attesa del deposito...';
      statusEl.className = 'text-sm font-medium text-yellow-400';
    } else if (shift.status === 'pending' || shift.status === 'processing') {
      statusEl.textContent = '⚙️ Conversione in corso...';
      statusEl.className = 'text-sm font-medium text-blue-400';
    } else if (shift.status === 'review') {
      statusEl.textContent = '🔍 In revisione...';
      statusEl.className = 'text-sm font-medium text-orange-400';
    } else if (shift.status === 'settled') {
      statusEl.textContent = `✅ Completato! ${shift.settleAmount} ${vault.currency} ricevuti.`;
      statusEl.className = 'text-sm font-medium text-green-400';
      clearInterval(ccPollInterval); ccPollInterval = null;
      if (shift.settleAmount) {
        vault.transactions.push({
          id: uid(), date: new Date().toISOString(),
          amount: parseFloat(shift.settleAmount),
          txHash: shift.settleHash || 'sideshift-' + shiftId, onChain: false, crossChain: true
        });
        await saveVaults();
      }
    } else if (shift.status === 'refund' || shift.status === 'expired') {
      statusEl.textContent = '❌ Ordine ' + (shift.status === 'expired' ? 'scaduto' : 'rimborsato');
      statusEl.className = 'text-sm font-medium text-red-400';
      clearInterval(ccPollInterval); ccPollInterval = null;
    }
  } catch { /* silent retry */ }
};

App.copyCCAddress = function() {
  const addr = document.getElementById('cc-deposit-address').textContent;
  if (addr && addr !== '—') navigator.clipboard.writeText(addr);
};

App.closeCrossChain = function() {
  if (ccPollInterval) { clearInterval(ccPollInterval); ccPollInterval = null; }
  App.closeModal('modal-crosschain');
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (vault) { renderVaultDetail(vault); renderDashboard(); App.openModal('modal-vault-detail'); }
};

// ─── FASE 3: Auto-MATIC (Gasless UX) ────────────────────────
async function getMaticBalance() {
  try {
    const provider = state.walletSigner?.provider || new ethers.JsonRpcProvider(POLYGON_RPC);
    const bal = await provider.getBalance(state.address);
    return Number(ethers.formatEther(bal));
  } catch { return null; }
}

async function checkAndShowMaticWarning() {
  const bal = await getMaticBalance();
  const warn = document.getElementById('matic-warning');
  if (warn) {
    if (bal !== null && bal < 0.005) {
      warn.classList.remove('hidden');
    } else {
      warn.classList.add('hidden');
    }
  }
  return bal;
}

App.autoGetMatic = async function() {
  if (!state.walletSigner) { showError('deposit-error', 'Non sei connesso. Riapri l\'app.'); return; }
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const destAddr = TOKEN_ADDRESSES[vault.currency];
  const destDec = TOKEN_DECIMALS[vault.currency] || 6;
  const maticNeeded = ethers.parseUnits('0.5', destDec);
  const warn = document.getElementById('matic-warning');

  try {
    warn.innerHTML = '⛽ Preparazione commissioni in corso...';
    const route = await getSwapQuote(destAddr, NATIVE_TOKEN, maticNeeded.toString(), destDec, 18);
    const swapTxData = await buildSwapTx(route, state.address);
    const token = new ethers.Contract(destAddr, ERC20_ABI, state.walletSigner);
    const approveTx = await token.approve(swapTxData.to, maticNeeded);
    await approveTx.wait();
    const tx = await state.walletSigner.sendTransaction({
      to: swapTxData.to, data: swapTxData.data, value: swapTxData.value || '0',
      gasLimit: swapTxData.gas || 400000n,
    });
    await tx.wait();
    warn.innerHTML = '✅ Commissioni pronte! Ora puoi continuare.';
    warn.className = 'bg-green-500/10 border border-green-500/30 text-green-400 text-xs p-2 rounded-xl mb-2';
    setTimeout(() => warn.classList.add('hidden'), 3000);
  } catch(err) {
    warn.innerHTML = '❌ Errore: ' + (err.reason || err.message || 'Swap fallito').slice(0,80) +
      '<br><span class="text-xs">Puoi anche mandare 0.1 MATIC al tuo indirizzo manualmente.</span>';
    warn.className = 'bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2 rounded-xl mb-2';
  }
};

// ─── Helpers ─────────────────────────────────────────────────
function vaultTotal(vault) {
  return vault.transactions.reduce((s,t) => s+t.amount, 0);
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function isVaultUnlocked(vault) {
  const mode = vault.unlockMode ?? 0;
  const dateMet   = vault.unlockDate ? daysUntil(vault.unlockDate) <= 0 : false;
  const amountMet = vault.target ? vaultTotal(vault) >= vault.target : false;
  if (mode === 0) return dateMet;
  if (mode === 1) return amountMet;
  if (mode === 2) return dateMet || amountMet;
  if (mode === 3) return dateMet && amountMet;
  return false;
}

function unlockModeLabel(mode) {
  return (UNLOCK_MODES[mode] || UNLOCK_MODES[0]).label;
}

App.setUnlockMode = function(mode) {
  state.selectedUnlockMode = mode;
  document.querySelectorAll('.unlock-mode-btn').forEach((btn, i) => {
    if (i === mode) {
      btn.className = 'unlock-mode-btn py-2.5 rounded-xl text-xs font-semibold border-2 border-blue-500 bg-blue-500/15 text-blue-400 transition-all';
    } else {
      btn.className = 'unlock-mode-btn py-2.5 rounded-xl text-xs font-semibold border-2 border-slate-700 text-slate-400 transition-all';
    }
  });
  document.getElementById('mode-hint').textContent = UNLOCK_MODES[mode].hint;
  const showDate   = mode === 0 || mode === 2 || mode === 3;
  const showTarget = mode === 1 || mode === 2 || mode === 3;
  document.getElementById('vault-date-row').classList.toggle('hidden', !showDate);
  document.getElementById('vault-target-row').classList.toggle('hidden', !showTarget);
};

function fmtDate(dateStr) {
  return new Date(dateStr+'T00:00:00').toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtDateShort(dateStr) {
  return new Date(dateStr+'T00:00:00').toLocaleDateString('it-IT', { month:'short', year:'2-digit' });
}

function renderSeedWordGrid(mnemonic, containerId) {
  document.getElementById(containerId).innerHTML = mnemonic.split(' ').map((w,i) => `
    <div class="bg-slate-800 rounded-xl p-2.5 text-center border border-slate-700">
      <span class="text-slate-500 text-xs block">${i+1}</span>
      <span class="font-mono font-semibold text-sm sw-text">${w}</span>
    </div>`).join('');
}

function renderRestoreInputs() {
  document.getElementById('restore-words-grid').innerHTML = Array.from({length:12},(_,i) => `
    <div class="relative">
      <span class="absolute top-1 left-2 text-slate-500 text-xs select-none">${i+1}</span>
      <input type="text" class="restore-word w-full bg-slate-900 border border-slate-600 rounded-xl px-2 pt-5 pb-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500 lowercase"
        autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">
    </div>`).join('');

  // Smart paste: se incolli tutta la seed phrase nella prima casella, la distribuisce
  document.querySelectorAll('.restore-word').forEach((input, idx) => {
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text').trim();
      const words = text.split(/\s+/);
      if (words.length > 1) {
        e.preventDefault();
        const all = document.querySelectorAll('.restore-word');
        words.slice(0, 12).forEach((w, i) => { if (all[idx + i]) all[idx + i].value = w.toLowerCase(); });
      }
    });
  });
}

// ─── Init ────────────────────────────────────────────────────

(async function init() {
  const savedAddress = localStorage.getItem(STORAGE.ADDRESS);
  const seedBlob = localStorage.getItem(STORAGE.SEED_ENC);
  if (savedAddress && seedBlob) {
    const short = savedAddress.slice(0,6) + '…' + savedAddress.slice(-4);
    document.getElementById('unlock-address-short').textContent = short;
    showScreen('screen-unlock');
  } else {
    showScreen('screen-welcome');
  }
})();
