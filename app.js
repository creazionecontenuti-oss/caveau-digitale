// ============================================================
// CAVEAU DIGITALE — app.js
// Non-Custodial Web3 Time-Lock Savings Protocol
// ============================================================

const STORAGE = {
  ADDRESS:   'caveau_address',
  SEED_ENC:  'caveau_seed_enc',   // mnemonic encrypted with PIN-derived key
  VAULTS_ENC:'caveau_vaults_enc', // vaults encrypted with mnemonic-derived key
  PIN_SALT:  'caveau_pin_salt',
  BIO_CRED_ID: 'caveau_bio_cred_id',
  BIO_PIN_ENC: 'caveau_bio_pin_enc',
  BIO_PROMPT_SEEN: 'caveau_bio_prompt_seen',
  INSTALL_BANNER_HIDE: 'caveau_install_banner_hide',
  TW_AUTH_MODE: 'caveau_tw_auth',    // '1' if user logged in via Thirdweb
  TW_EMAIL:    'caveau_tw_email',    // user email for display
  DELETED_VAULTS: 'caveau_deleted_vaults', // JSON array of {onChainVaultId, strategy} for vaults deleted by user
  GAS_LOG: 'caveau_gas_log', // JSON array of gas cost records per address
  DISPLAY_CURRENCY: 'caveau_display_currency', // 'USD' | 'EUR' | 'POL'
  BIO_TW_ENABLED: 'caveau_bio_tw', // '1' if Thirdweb user enabled biometric gate
  BANK_NAME: 'caveau_bank_name',
  BANK_IBAN: 'caveau_bank_iban',
};

// ─── Thirdweb Configuration ─────────────────────────────────
const THIRDWEB_CLIENT_ID = '236e3f9e03a7976c341d044228336144';

const DONATION_ADDRESS = '0xa359bb875A08b0A392541638Aa614a2e59D63b2C';
let f7app; // Framework7 app instance, initialized in init()

/* ── Haptic feedback (Android + iOS 18+) ── */
const _hapticEl = (() => {
  try {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.setAttribute('switch', '');
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none';
    document.documentElement.appendChild(el);
    return el;
  } catch(e) { return null; }
})();
function haptic(ms) {
  ms = ms || 15;
  // Android — Vibration API
  if (navigator.vibrate) { try { navigator.vibrate(ms); } catch(e){} return; }
  // iOS 18+ — hidden switch toggle triggers Taptic Engine
  if (_hapticEl) { try { _hapticEl.checked = !_hapticEl.checked; _hapticEl.dispatchEvent(new Event('change', {bubbles:true})); } catch(e){} }
}
const APP_VERSION = 'v9.16.1-readme-license';
const APP_UPDATED_AT = '2026-03-04 17:28 CET';

// ─── Blockchain Config (Polygon Mainnet) ─────────────────────
const POLYGON_RPC_LIST = [
  'https://1rpc.io/matic',
  'https://polygon-rpc.com',
  'https://rpc.ankr.com/polygon',
];
let _currentRpcIndex = 0;
const POLYGON_RPC = POLYGON_RPC_LIST[0];

// Fallback RPC provider: tries each RPC in order until one works
function getFallbackProvider() {
  return new ethers.FallbackProvider(
    POLYGON_RPC_LIST.map((url, i) => ({
      provider: new ethers.JsonRpcProvider(url),
      priority: i + 1,
      stallTimeout: 3000,
      weight: 1,
    })),
    1 // quorum: only 1 provider needs to respond
  );
}
const CAVEAU_CONTRACT = '0x1FcbF2A6456aF7435c868666Be25774d92c2BA06';
const CAVEAU_AAVE_CONTRACT = '0xDF9c64E845C0E9D54175C7d567d5d0e0b9EE3501';
// Tokens supported by Aave V3 on Polygon
const AAVE_SUPPORTED_TOKENS = ['USDC', 'DAI', 'USDT'];
const TOKEN_ADDRESSES = {
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  DAI:  '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  EURe: '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6',
  ZCHF: '0x02567e4b14b25549331fcee2b56c647a8bab16fd',
};
const TOKEN_DECIMALS  = { USDC: 6, DAI: 18, USDT: 6, EURe: 18, ZCHF: 18 };
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)'
];
const CAVEAU_ABI = [
  'function createVault(address token, uint256 targetAmount, uint40 unlockDate, uint8 unlockMode, string name, string icon) external returns (uint256 vaultId)',
  'function deposit(uint256 vaultId, uint256 amount) external',
  'function withdraw(uint256 vaultId) external',
  'function isUnlocked(uint256 vaultId) view returns (bool)',
  'function getVault(uint256 vaultId) view returns (address owner, address token, uint256 targetAmount, uint40 unlockDate, uint256 totalDeposited, uint8 unlockMode, bool withdrawn, bool unlocked, string name, string icon)',
  'function getOwnerVaults(address owner) view returns (uint256[])',
  'function getOwnerVaultCount(address owner) view returns (uint256)',
  'function updateVaultMetadata(uint256 vaultId, string name, string icon) external',
  'function nextVaultId() view returns (uint256)',
  'event VaultCreated(uint256 indexed vaultId, address indexed owner, address token, uint8 unlockMode, uint256 targetAmount, uint40 unlockDate, string name, string icon)',
  'event Deposited(uint256 indexed vaultId, address indexed depositor, uint256 amount)',
  'event Withdrawn(uint256 indexed vaultId, uint256 amount)',
  'error VaultNotUnlocked()',
  'error NotVaultOwner()',
  'error AlreadyWithdrawn()',
  'error NoFundsToWithdraw()',
  'error VaultDoesNotExist()',
  'error InvalidVaultId()'
];
const CAVEAU_AAVE_ABI = [
  'function createVault(address token, uint256 targetAmount, uint40 unlockDate, uint8 unlockMode, string name, string icon) external returns (uint256 vaultId)',
  'function deposit(uint256 vaultId, uint256 amount) external',
  'function withdraw(uint256 vaultId) external',
  'function isUnlocked(uint256 vaultId) view returns (bool)',
  'function getVault(uint256 vaultId) view returns (address owner, address token, uint256 targetAmount, uint40 unlockDate, uint256 principalDeposited, uint8 unlockMode, bool withdrawn, bool unlocked, string name, string icon, uint256 currentValue, uint256 earnedInterest)',
  'function getVaultValue(uint256 vaultId) view returns (uint256)',
  'function getEarnedInterest(uint256 vaultId) view returns (uint256)',
  'function getOwnerVaults(address owner) view returns (uint256[])',
  'function getOwnerVaultCount(address owner) view returns (uint256)',
  'function updateVaultMetadata(uint256 vaultId, string name, string icon) external',
  'function nextVaultId() view returns (uint256)',
  'event VaultCreated(uint256 indexed vaultId, address indexed owner, address token, uint8 unlockMode, uint256 targetAmount, uint40 unlockDate, string name, string icon)',
  'event Deposited(uint256 indexed vaultId, address indexed depositor, uint256 amount, uint256 shares)',
  'event Withdrawn(uint256 indexed vaultId, uint256 principal, uint256 totalWithdrawn, uint256 interest)',
  'error VaultNotUnlocked()',
  'error NotVaultOwner()',
  'error AlreadyWithdrawn()',
  'error NoFundsToWithdraw()',
  'error VaultDoesNotExist()',
  'error InvalidVaultId()'
];
function getUnlockModes() {
  return [
    { label: t('unlock_mode.date'),  hint: t('unlock_mode.hint_date') },
    { label: t('unlock_mode.target'), hint: t('unlock_mode.hint_target') },
    { label: t('unlock_mode.first'), hint: t('unlock_mode.hint_first') },
    { label: t('unlock_mode.both'),  hint: t('unlock_mode.hint_both') },
  ];
}

function clearTwStorage() {
  // Clear Thirdweb-related localStorage keys
  const keysToDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('thirdweb') || key.startsWith('walletConnect'))) keysToDelete.push(key);
  }
  keysToDelete.forEach((key) => localStorage.removeItem(key));
  // Also clear legacy Privy keys if present
  const privyKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('privy_')) privyKeys.push(key);
  }
  privyKeys.forEach((key) => localStorage.removeItem(key));
}

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
const SETTLE_METHODS = { USDC: 'usdcpolygon', USDT: 'usdtpolygon', DAI: 'daipolygon' };

const PRESETS = [
  { icon: '🏠', name: 'Casa',       color: '#f59e0b', f7: 'house_fill' },
  { icon: '🚗', name: 'Auto',       color: '#3b82f6', f7: 'car_fill' },
  { icon: '✈️',  name: 'Vacanze',   color: '#8b5cf6', f7: 'airplane' },
  { icon: '💍', name: 'Matrimonio', color: '#ec4899', f7: 'heart_fill' },
  { icon: '🎓', name: 'Istruzione', color: '#10b981', f7: 'book_fill' },
  { icon: '🚑', name: 'Emergenze',  color: '#ef4444', f7: 'bolt_fill' },
  { icon: '💻', name: 'Tech',       color: '#06b6d4', f7: 'desktopcomputer' },
  { icon: '🏖️', name: 'Mare',       color: '#f97316', f7: 'sun_max_fill' },
  { icon: '🏍️', name: 'Moto',       color: '#84cc16', f7: 'speedometer' },
  { icon: '💰', name: 'Risparmio',  color: '#6366f1', f7: 'money_dollar_circle_fill' }
];

// Emoji → F7 icon map (for backward compat with existing vaults)
const ICON_MAP = {};
PRESETS.forEach(function(p){ ICON_MAP[p.icon] = { f7: p.f7, color: p.color }; });

function renderVaultIcon(icon, size, showGradient) {
  const mapped = ICON_MAP[icon];
  if (mapped) {
    const iconSize = Math.round(size * 0.5);
    const bg = showGradient ? 'background:linear-gradient(135deg,' + mapped.color + ',' + adjustColor(mapped.color, -30) + ')' : 'background:rgba(148,163,184,.12)';
    const clr = showGradient ? '#fff' : mapped.color;
    return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;'+bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="f7-icons" style="font-size:'+iconSize+'px;color:'+clr+'">'+mapped.f7+'</i></div>';
  }
  return '<span style="font-size:'+Math.round(size*0.7)+'px;line-height:1">'+icon+'</span>';
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

// ─── Public App namespace ──────────────────────────────────
const App = {};

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '');
}

let _savedScrollY = 0;
function syncBodyScrollLock() {
  const hasActiveModal = !!document.querySelector('.modal-overlay.active');
  if (hasActiveModal && !document.body.classList.contains('modal-open')) {
    // Lock: save scroll position and fix body
    _savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.classList.add('modal-open');
  } else if (!hasActiveModal && document.body.classList.contains('modal-open')) {
    // Unlock: restore scroll position
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.classList.remove('modal-open');
    window.scrollTo(0, _savedScrollY);
  }
}

function focusPrimaryInputForModal(id) {
  const modalFocusMap = {
    'modal-new-vault': 'vault-name',
    'modal-onramp': 'onramp-amount-input',
    'modal-pin-verify': 'pin-native-verify',
  };
  const inputId = modalFocusMap[id];
  if (!inputId) return;
  const input = document.getElementById(inputId);
  if (input) setTimeout(() => input.focus(), 120);
}

function updateInstallBanner() {
  const banner = document.getElementById('install-banner');
  const iosText = document.getElementById('install-banner-ios');
  const androidText = document.getElementById('install-banner-android');
  const androidManualText = document.getElementById('install-banner-android-manual');
  const installBtn = document.getElementById('install-app-btn');
  if (!banner || !iosText || !androidText || !androidManualText || !installBtn) return;

  const dismissed = localStorage.getItem(STORAGE.INSTALL_BANNER_HIDE) === '1';
  const standalone = isStandaloneApp();
  const canPrompt = !!state.deferredInstallPrompt;
  const ios = isIosDevice();

  if (dismissed || standalone) {
    banner.classList.add('hidden');
    return;
  }

  const showIosInstructions = ios && !canPrompt;
  const showInstallPrompt = canPrompt;
  const showAndroidManual = !ios && !canPrompt;

  iosText.classList.toggle('hidden', !showIosInstructions);
  androidText.classList.toggle('hidden', !showInstallPrompt);
  androidManualText.classList.toggle('hidden', !showAndroidManual);
  installBtn.classList.toggle('hidden', !showInstallPrompt);
  banner.classList.toggle('hidden', !(showIosInstructions || showInstallPrompt || showAndroidManual));
}

function updateBuildBadge(extra = '') {
  const suffix = extra ? ` • ${extra}` : '';
  const text = `${APP_VERSION} • ${APP_UPDATED_AT}${suffix}`;
  // Inline badge in Home tab
  const homeBadge = document.getElementById('home-version-badge');
  if (homeBadge) homeBadge.textContent = text;
  // Settings tab badge
  const settingsBadge = document.getElementById('settings-version-badge');
  if (settingsBadge) settingsBadge.textContent = text;
  // Legacy fixed badge (fallback)
  const fixedBadge = document.getElementById('app-build-badge');
  if (fixedBadge) fixedBadge.textContent = t('badge.text', {version: APP_VERSION, updated: APP_UPDATED_AT}) + suffix;
}

// Expose modal helpers early so inline onclick handlers can resolve them
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // F7 Sheet Modal
  if (el.classList.contains('sheet-modal') && f7app) {
    f7app.sheet.open(el);
    focusPrimaryInputForModal(id);
    if (typeof applyTranslations === 'function') applyTranslations();
    return;
  }
  // Legacy: custom modal-overlay
  const sheet = el.querySelector(':scope > div');
  if (sheet) { sheet.style.transform = ''; sheet.style.transition = ''; }
  el.classList.add('active');
  syncBodyScrollLock();
  focusPrimaryInputForModal(id);
  if (typeof applyTranslations === 'function') applyTranslations();
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  // F7 Sheet Modal
  if (el.classList.contains('sheet-modal') && f7app) {
    f7app.sheet.close(el);
    if (id === 'modal-onramp') document.getElementById('onramp-iframe')?.setAttribute('src', '');
    return;
  }
  // Legacy: custom modal-overlay
  if (!el.classList.contains('active')) return;
  const sheet = el.querySelector(':scope > div');
  if (sheet) {
    sheet.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
      el.classList.remove('active');
      sheet.style.transform = ''; sheet.style.transition = '';
      if (id === 'modal-onramp') document.getElementById('onramp-iframe')?.setAttribute('src', '');
      syncBodyScrollLock();
    }, 280);
  } else {
    el.classList.remove('active');
    if (id === 'modal-onramp') document.getElementById('onramp-iframe')?.setAttribute('src', '');
    syncBodyScrollLock();
  }
}
App.openModal = openModal;
App.closeModal = closeModal;

// ─── Bottom Sheet Drag-to-Dismiss ─────────────────────────────
function initSheetDrags() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    const sheet = overlay.querySelector(':scope > div');
    if (!sheet || sheet._sheetDragInit) return;
    sheet._sheetDragInit = true;
    // Inject drag handle
    if (!sheet.querySelector('.sheet-handle')) {
      const h = document.createElement('div');
      h.className = 'sheet-handle';
      sheet.prepend(h);
    }
    let startY = 0, curY = 0, dragging = false;
    const scrollable = sheet.querySelector('.overflow-y-auto') || sheet;
    sheet.addEventListener('touchstart', e => {
      // Only start drag if scrolled to top (or touch is on handle)
      const onHandle = e.target.closest('.sheet-handle');
      const atTop = scrollable.scrollTop <= 0;
      if (!onHandle && !atTop) return;
      startY = e.touches[0].clientY; curY = startY; dragging = true;
      sheet.style.transition = 'none';
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (!dragging) return;
      curY = e.touches[0].clientY;
      const dy = Math.max(0, curY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      const dy = curY - startY;
      sheet.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1)';
      if (dy > 80) {
        // Dismiss
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => {
          overlay.classList.remove('active');
          sheet.style.transform = ''; sheet.style.transition = '';
          syncBodyScrollLock();
        }, 280);
      } else {
        sheet.style.transform = 'translateY(0)';
      }
    });
  });
}

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
  lastUnlockPin:    '',
  afterRestorePin:  false,  // true when PIN set comes after restore
  walletSigner:     null,   // ethers.Wallet connected to Polygon provider
  pinVerifyBuffer:  '',
  pinVerifyCallback: null,
  currentLockAmount: 0,
  selectedUnlockMode: 0,  // 0=date, 1=amount, 2=OR, 3=AND
  selectedStrategy: 'base', // 'base' or 'aave'
  deferredInstallPrompt: null,
  // Thirdweb
  twClient:   null,   // Thirdweb client instance
  twWallet:   null,   // inAppWallet instance
  twAccount:  null,   // connected account
  twReady:    false,  // SDK loaded and initialized
  twEmail:    '',     // email being used for login
  isTwAuth:   false,  // true if current session uses Thirdweb (not PIN)
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

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function randomChallenge(size = 32) {
  const challenge = new Uint8Array(size);
  crypto.getRandomValues(challenge);
  return challenge;
}

function hasBiometricCapability() {
  return window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials?.create && !!navigator.credentials?.get;
}

function isTwUser() {
  return localStorage.getItem(STORAGE.TW_AUTH_MODE) === '1';
}

function isBioConfigured() {
  if (isTwUser()) {
    return !!localStorage.getItem(STORAGE.BIO_CRED_ID) && localStorage.getItem(STORAGE.BIO_TW_ENABLED) === '1';
  }
  return !!localStorage.getItem(STORAGE.BIO_CRED_ID) && !!localStorage.getItem(STORAGE.BIO_PIN_ENC);
}

// Pure WebAuthn biometric verification (no PIN) — used for Thirdweb gate
async function verifyBiometric() {
  const credId = localStorage.getItem(STORAGE.BIO_CRED_ID);
  if (!credId) throw new Error('no-credential');
  await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ type: 'public-key', id: base64ToBytes(credId) }],
      userVerification: 'required',
      timeout: 60000
    }
  });
  return true;
}

function updateOnrampNoticeVisibility() {
  const box = document.getElementById('onramp-provider-notice');
  if (box) box.classList.remove('hidden');
}

function maybePromptBiometricOptIn(pin) {
  if (!hasBiometricCapability()) return;
  if (!state.address || !pin) return;
  const configured = !!localStorage.getItem(STORAGE.BIO_CRED_ID) && !!localStorage.getItem(STORAGE.BIO_PIN_ENC);
  if (configured) return;
  if (localStorage.getItem(STORAGE.BIO_PROMPT_SEEN) === '1') return;

  state.lastUnlockPin = pin;
  setTimeout(() => App.openModal('modal-biometric-optin'), 250);
}

function maybePromptBiometricOptInTw() {
  if (!hasBiometricCapability()) return;
  if (!state.address) return;
  if (isBioConfigured()) return;
  if (localStorage.getItem(STORAGE.BIO_PROMPT_SEEN) === '1') return;
  setTimeout(() => App.openModal('modal-biometric-optin'), 400);
}

// ─── Storage ─────────────────────────────────────────────────
async function saveVaults() {
  if (!state.vaultKey) return;
  localStorage.setItem(STORAGE.VAULTS_ENC, await encrypt(state.vaultKey, state.vaults));
}

async function loadVaults() {
  // 1. Try loading from localStorage (fast, offline)
  const blob = localStorage.getItem(STORAGE.VAULTS_ENC);
  if (blob && state.vaultKey) {
    try { state.vaults = await decrypt(state.vaultKey, blob); }
    catch { state.vaults = []; }
  } else {
    state.vaults = [];
  }

  // 2. Sync with on-chain data (merge any vaults from blockchain)
  if (state.address) {
    try { await syncVaultsFromChain(); }
    catch(e) { console.warn('[Chain] Vault sync failed (non-critical):', e); }
  }
}

// Map token addresses back to symbols
const TOKEN_ADDR_TO_SYMBOL = {};
Object.entries(TOKEN_ADDRESSES).forEach(([sym, addr]) => {
  TOKEN_ADDR_TO_SYMBOL[addr.toLowerCase()] = sym;
});

async function syncVaultsFromChain() {
  const provider = state.walletSigner?.provider || getFallbackProvider();

  let changed = false;

  // Sync from both contracts: base (V2) and Aave
  const contracts = [
    { contract: new ethers.Contract(CAVEAU_CONTRACT, CAVEAU_ABI, provider), strategy: 'base', label: 'Base' },
    { contract: new ethers.Contract(CAVEAU_AAVE_CONTRACT, CAVEAU_AAVE_ABI, provider), strategy: 'aave', label: 'Aave' },
  ];

  for (const { contract: caveau, strategy, label } of contracts) {
    let vaultIds;
    try {
      vaultIds = await caveau.getOwnerVaults(state.address);
    } catch {
      continue; // Contract might not have this user's vaults yet
    }

    if (!vaultIds || vaultIds.length === 0) continue;

    for (const vid of vaultIds) {
      const id = Number(vid);

      // Skip vaults the user has deleted (localStorage fallback)
      if (isVaultDeleted(id, strategy)) continue;

      // Fetch vault data from chain
      let v;
      try { v = await caveau.getVault(id); }
      catch(e) { console.warn(`[Chain/${label}] Failed to read vault`, id, e); continue; }

      // Skip vaults marked as deleted on-chain
      if (v.name === '__DELETED__') continue;

      const tokenAddr = v.token.toLowerCase();
      const currency = TOKEN_ADDR_TO_SYMBOL[tokenAddr] || 'USDC';
      const decimals = TOKEN_DECIMALS[currency] || 6;

      // For Aave vaults, use principalDeposited; for base, use totalDeposited
      const depositedField = strategy === 'aave' ? v.principalDeposited : v.totalDeposited;

      // Read deposit events for this vault to rebuild full transaction history
      let txHistory = [];
      try {
        const depositFilter = caveau.filters.Deposited(id);
        const events = await caveau.queryFilter(depositFilter);
        txHistory = events.map(ev => ({
          id: uid(),
          date: new Date(ev.blockNumber * 1000).toISOString(),
          amount: Number(ethers.formatUnits(ev.args.amount, decimals)),
          txHash: ev.transactionHash,
          onChain: true,
          restoredFromChain: true
        }));
        // Try to get actual timestamps for each event
        for (const tx of txHistory) {
          try {
            const ev = events.find(e => e.transactionHash === tx.txHash);
            if (ev) {
              const block = await provider.getBlock(ev.blockNumber);
              if (block) tx.date = new Date(block.timestamp * 1000).toISOString();
            }
          } catch { /* use approximate date */ }
        }
      } catch(e) {
        console.warn(`[Chain/${label}] Failed to read deposit events for vault`, id, e);
        const totalDep = Number(ethers.formatUnits(depositedField, decimals));
        if (totalDep > 0) {
          txHistory = [{ id: uid(), date: new Date().toISOString(), amount: totalDep, onChain: true, recovered: true }];
        }
      }

      // Use composite key to distinguish base vs aave vaults with same on-chain ID
      const existing = state.vaults.find(lv =>
        lv.onChainVaultId === id && (lv.onChainContract || lv.strategy || 'base') === strategy
      );
      if (existing) {
        const onChainName = v.name || existing.name;
        const onChainIcon = v.icon || existing.icon;
        let vaultChanged = false;
        if (onChainName !== existing.name) { existing.name = onChainName; vaultChanged = true; }
        if (onChainIcon !== existing.icon) { existing.icon = onChainIcon; vaultChanged = true; }
        existing.withdrawn = v.withdrawn;
        existing.strategy = strategy;
        existing.onChainContract = strategy;
        // Always sync unlockDate from chain to avoid UI/contract mismatch
        const chainTs = Number(v.unlockDate);
        if (chainTs > 0) {
          const chainDateLocal = toLocalDatetimeString(new Date(chainTs * 1000));
          if (existing.unlockDate !== chainDateLocal) { existing.unlockDate = chainDateLocal; vaultChanged = true; }
        }
        // For Aave vaults, update interest data
        if (strategy === 'aave' && v.currentValue !== undefined) {
          existing._aaveCurrentValue = Number(ethers.formatUnits(v.currentValue, decimals));
          existing._aaveEarnedInterest = Number(ethers.formatUnits(v.earnedInterest, decimals));
        }
        // Replace on-chain transactions with fresh chain data (keep local manual notes only)
        const localOnly = existing.transactions.filter(t => !t.onChain && !t.restoredFromChain && !t.recovered);
        const oldCount = existing.transactions.length;
        existing.transactions = [...localOnly, ...txHistory];
        if (existing.transactions.length !== oldCount) vaultChanged = true;
        if (vaultChanged) changed = true;
      } else {
        const unlockDate = Number(v.unlockDate) > 0
          ? toLocalDatetimeString(new Date(Number(v.unlockDate) * 1000))
          : null;

        const newVault = {
          id: uid(),
          name: v.name || `Vault #${id}`,
          icon: v.icon || '🐷',
          color: strategy === 'aave' ? 'from-emerald-600 to-teal-700' : 'from-blue-600 to-indigo-700',
          target: Number(ethers.formatUnits(v.targetAmount, decimals)),
          currency,
          unlockDate,
          unlockMode: Number(v.unlockMode),
          strategy,
          onChainContract: strategy,
          transactions: txHistory,
          onChainVaultId: id,
          withdrawn: v.withdrawn,
          createdAt: new Date().toISOString(),
          restoredFromChain: true
        };

        // For Aave vaults, add interest data
        if (strategy === 'aave' && v.currentValue !== undefined) {
          newVault._aaveCurrentValue = Number(ethers.formatUnits(v.currentValue, decimals));
          newVault._aaveEarnedInterest = Number(ethers.formatUnits(v.earnedInterest, decimals));
        }

        state.vaults.push(newVault);
        changed = true;
        console.log(`[Chain/${label}] Recovered vault:`, newVault.name, '(on-chain ID:', id, ')');
      }
    }
  }

  if (changed) await saveVaults();
}

// ─── Screen helpers ──────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  // Lock viewport scroll when dashboard is active
  document.documentElement.classList.toggle('dashboard-active', id === 'screen-dashboard');

  const focusMap = {
    'screen-set-pin': 'pin-native-set',
    'screen-unlock': 'pin-native-unlock',
  };
  const focusId = focusMap[id];
  if (focusId) {
    const input = document.getElementById(focusId);
    if (input) setTimeout(() => input.focus(), 120);
  }
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

function getNativePinInput(context) {
  if (context === 'set') return document.getElementById('pin-native-set');
  if (context === 'unlock') return document.getElementById('pin-native-unlock');
  if (context === 'verify') return document.getElementById('pin-native-verify');
  return null;
}

function syncNativePinInput(context, val) {
  const input = getNativePinInput(context);
  if (input && input.value !== val) input.value = val;
}

App.onPinNativeInput = function(context, rawValue) {
  const val = String(rawValue || '').replace(/\D/g, '').slice(0, 6);
  syncNativePinInput(context, val);

  if (context === 'verify') {
    state.pinVerifyBuffer = val;
    updatePinDotsVerify(val.length);
    if (val.length === 6) state.pinVerifyCallback?.(val);
    return;
  }

  state.pinBuffer[context] = val;
  updatePinDots(context, val.length);
  if (val.length === 6) {
    if (context === 'set') handleSetPin();
    else handleUnlock();
  }
};

App.pinKeyPress = function(digit, context) {
  haptic(20);
  const buf = state.pinBuffer;
  if (buf[context].length >= 6) return;
  buf[context] += digit;
  syncNativePinInput(context, buf[context]);
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
  syncNativePinInput(context, buf[context]);
  updatePinDots(context, buf[context].length);
};

async function handleSetPin() {
  const pin = state.pinBuffer.set;
  if (state.pinStage === 'first') {
    state.pinFirst = pin;
    state.pinBuffer.set = '';
    syncNativePinInput('set', '');
    updatePinDots('set', 0);
    document.getElementById('set-pin-title').textContent = t('pin.confirm_title');
    document.getElementById('set-pin-desc').textContent = t('pin.confirm_desc');
    state.pinStage = 'confirm';
    return;
  }
  // confirm stage
  if (pin !== state.pinFirst) {
    state.pinBuffer.set = ''; state.pinFirst = ''; state.pinStage = 'first';
    syncNativePinInput('set', '');
    updatePinDots('set', 0);
    document.getElementById('set-pin-title').textContent = t('pin.create_title');
    document.getElementById('set-pin-desc').textContent = t('pin.create_desc');
    showError('pin-error-set', t('pin.mismatch'));
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
    const provider = getFallbackProvider();
    state.walletSigner = wallet2.connect(provider);
  } catch { /* RPC non-critical */ }
  state.tempMnemonic = null;
  state.pinBuffer.set = ''; state.pinFirst = ''; state.pinStage = 'first';
  syncNativePinInput('set', '');
  await saveVaults();
  showDashboard();
  maybePromptBiometricOptIn(pin);
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
      const provider = getFallbackProvider();
      state.walletSigner = wallet.connect(provider);
    } catch { /* RPC non-critical */ }
    state.lastUnlockPin = pin;
    state.pinBuffer.unlock = '';
    syncNativePinInput('unlock', '');
    updatePinDots('unlock', 0);
    await loadVaults();
    showDashboard();
    updateBiometricUI();
  } catch {
    state.pinBuffer.unlock = '';
    syncNativePinInput('unlock', '');
    updatePinDots('unlock', 0);
    showError('pin-error-unlock', t('pin.wrong'));
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
  document.getElementById('set-pin-title').textContent = t('pin.create_title');
  document.getElementById('set-pin-desc').textContent = t('pin.create_desc');
  document.getElementById('pin-error-set').classList.add('hidden');
  showScreen('screen-set-pin');
};

App.copySeedCreate = function() {
  if (!state.tempMnemonic) return;
  navigator.clipboard.writeText(state.tempMnemonic);
  const btn = document.getElementById('copy-seed-create-btn');
  const orig = btn.textContent;
  btn.textContent = t('common.copied_btn');
  setTimeout(() => { btn.textContent = orig; }, 2000);
};

App.goBack = function() { showScreen('screen-welcome'); };

App.showRestoreWallet = function() {
  document.getElementById('restore-title').textContent = t('restore.title');
  document.getElementById('restore-desc').textContent = t('restore.desc');
  renderRestoreInputs();
  showScreen('screen-seed-restore');
};

App.forgotPin = function() {
  document.getElementById('restore-title').textContent = t('restore.forgot_title');
  document.getElementById('restore-desc').textContent = t('restore.forgot_desc');
  state.afterRestorePin = true;
  renderRestoreInputs();
  showScreen('screen-seed-restore');
};

App.restoreWallet = async function() {
  const words = [...document.querySelectorAll('.restore-word')]
    .map(i => i.value.trim().toLowerCase()).filter(w => w);
  if (words.length !== 12) {
    showError('restore-error', t('restore.error_empty'));
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
    document.getElementById('set-pin-title').textContent = t('pin.new_title');
    document.getElementById('set-pin-desc').textContent = t('pin.new_desc');
    document.getElementById('pin-error-set').classList.add('hidden');
    showScreen('screen-set-pin');
  } catch {
    showError('restore-error', t('restore.error_wrong'));
  }
};

// ─── Live Balance ────────────────────────────────────────────
const _bal = { interval: null, last: null, refreshing: false, POLL_MS: 30000 };

async function refreshWalletBalance(silent) {
  if (!state.address || _bal.refreshing) return;
  _bal.refreshing = true;
  const dot = document.getElementById('balance-live-dot');
  const spinner = document.getElementById('balance-spinner');
  if (!silent && spinner) spinner.classList.remove('hidden');
  if (dot) dot.classList.add('animate-pulse');

  try {
    const provider = state.walletSigner?.provider || getFallbackProvider();
    const tokens = ['USDC','DAI','USDT','EURe','ZCHF'];
    const results = await Promise.allSettled(
      tokens.map(t => {
        const c = new ethers.Contract(TOKEN_ADDRESSES[t], ERC20_ABI, provider);
        return c.balanceOf(state.address).then(r => Number(ethers.formatUnits(r, TOKEN_DECIMALS[t] || 6)));
      })
    );
    let total = 0;
    const breakdown = {};
    tokens.forEach((t, i) => {
      const val = results[i].status === 'fulfilled' ? results[i].value : 0;
      breakdown[t] = val;
      total += val;
    });

    // Store raw USD total for currency conversion
    state._walletBalanceUsd = total;

    // Update UI in preferred currency
    const cur = getDisplayCurrency();
    const displayTotal = convertFromUsd(total, cur);
    const el = document.getElementById('wallet-balance-amount');
    if (el) {
      const prev = parseFloat(el.textContent) || 0;
      el.textContent = displayTotal.toFixed(2);
      // Flash green if balance increased
      if (displayTotal > prev + 0.01) {
        el.classList.add('text-green-400');
        setTimeout(() => el.classList.remove('text-green-400'), 2000);
      }
    }
    const curSymEl = document.getElementById('wallet-balance-cur');
    if (curSymEl) curSymEl.textContent = currencySymbol(cur);

    // Update POL (gas) balance — store in state for gas card
    try {
      const provider = state.walletSigner?.provider || getFallbackProvider();
      state._polBalance = Number(ethers.formatEther(await provider.getBalance(state.address)));
    } catch(e) { console.warn('[Balance] POL fetch failed:', e); }

    // Timestamp
    _bal.last = new Date();
    const tsEl = document.getElementById('balance-timestamp');
    if (tsEl) tsEl.textContent = _bal.last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Update gas card with fresh POL balance
    updateGasCard();
  } catch(e) {
    console.warn('[Balance] Refresh failed:', e);
  } finally {
    _bal.refreshing = false;
    if (spinner) spinner.classList.add('hidden');
    if (dot) { dot.classList.remove('animate-pulse', 'bg-slate-500'); dot.classList.add('bg-green-400'); }
  }
}

async function updateGasCard() {
  const card = document.getElementById('gas-card');
  if (!card || !state.address) { if (card) card.classList.add('hidden'); return; }
  card.classList.remove('hidden');

  await fetchGasHistory();
  const polBal = state._polBalance || 0;
  const gasLog = getGasLog();
  const totalSpent = gasLog.reduce((s, r) => s + (r.pol || 0), 0);

  // Fetch POL price if stale
  if (_polPriceUsd === 0) await fetchPolPrice();

  const cur = getDisplayCurrency();
  const cs = currencySymbol(cur);
  const balUsd = polBal * _polPriceUsd;
  const spentUsd = totalSpent * _polPriceUsd;

  // Balance — primary in chosen currency
  const balValEl = document.getElementById('gas-balance-val');
  const balCurEl = document.getElementById('gas-balance-cur');
  const balPolEl = document.getElementById('gas-balance-pol');
  if (balValEl) {
    if (cur === 'POL') {
      balValEl.textContent = polBal.toFixed(4);
    } else {
      balValEl.textContent = _polPriceUsd > 0 ? convertFromUsd(balUsd, cur).toFixed(2) : '—';
    }
    if (polBal < 0.001) balValEl.className = 'text-sm font-semibold text-red-400';
    else if (polBal < 0.01) balValEl.className = 'text-sm font-semibold text-amber-400';
    else balValEl.className = 'text-sm font-semibold text-emerald-400';
  }
  if (balCurEl) balCurEl.textContent = cur === 'POL' ? 'POL' : cs;
  if (balPolEl) balPolEl.textContent = cur !== 'POL' ? `(${polBal.toFixed(4)} POL)` : '';

  // Spent — primary in chosen currency
  const spentValEl = document.getElementById('gas-spent-val');
  const spentCurEl = document.getElementById('gas-spent-cur');
  const spentPolEl = document.getElementById('gas-spent-pol');
  if (spentValEl) {
    if (cur === 'POL') {
      spentValEl.textContent = totalSpent.toFixed(4);
    } else {
      spentValEl.textContent = _polPriceUsd > 0 ? convertFromUsd(spentUsd, cur).toFixed(4) : '—';
    }
  }
  if (spentCurEl) spentCurEl.textContent = cur === 'POL' ? 'POL' : cs;
  if (spentPolEl) spentPolEl.textContent = cur !== 'POL' ? `(${totalSpent.toFixed(4)} POL)` : '';

  // Status + convert button
  const statusEl = document.getElementById('gas-status');
  const convertBtn = document.getElementById('pol-convert-btn');
  if (convertBtn) convertBtn.classList.toggle('hidden', polBal <= POL_KEEP + 0.5);
  if (statusEl) {
    if (polBal < 0.001) { statusEl.textContent = '⚠️ Ricarica'; statusEl.className = 'text-[10px] text-red-400 font-semibold'; }
    else if (polBal < 0.01) { statusEl.textContent = '⚡ Basso'; statusEl.className = 'text-[10px] text-amber-400'; }
    else { statusEl.textContent = '✓ OK'; statusEl.className = 'text-[10px] text-emerald-400'; }
  }
}

function startBalancePolling() {
  stopBalancePolling();
  refreshWalletBalance(false);
  _bal.interval = setInterval(() => refreshWalletBalance(true), _bal.POLL_MS);
}

function stopBalancePolling() {
  if (_bal.interval) { clearInterval(_bal.interval); _bal.interval = null; }
}

// Refresh when user returns to tab (e.g. from MoonPay)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.address) {
    const onDashboard = document.getElementById('screen-dashboard')?.classList.contains('active');
    if (onDashboard) refreshWalletBalance(false);
  }
});

// ─── Dashboard ───────────────────────────────────────────────
async function showDashboard() {
  showScreen('screen-dashboard');
  _gasHistoryFetched = false;
  document.getElementById('settings-address').textContent = state.address;
  const link = document.getElementById('polygonscan-link');
  link.href = `https://polygonscan.com/address/${state.address}`;
  renderDashboard();
  checkVaultNotifications();
  startBalancePolling();
  await fetchAllRates(); // fetch EUR/USD + POL/USD rates
  checkMaticOnboarding();
  initSheetDrags();
}

async function checkVaultNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission !== 'granted') return;
  const notified = JSON.parse(localStorage.getItem('caveau_notified') || '{}');
  let changed = false;
  state.vaults.forEach(v => {
    if (isVaultUnlocked(v) && !notified[v.id]) {
      new Notification(t('notify.vault_open', {icon: v.icon, name: v.name}), {
        body: t('notify.vault_ready'),
        icon: '/icon-192.webp', tag: 'vault-' + v.id
      });
      notified[v.id] = true;
      changed = true;
    }
  });
  if (changed) localStorage.setItem('caveau_notified', JSON.stringify(notified));
}

// ─── Quick Actions (Home) ─────────────────────────────────────
const _withdraw = { amount: 0, totalUsd: 0, balances: {} };

App.goToWithdraw = async function() {
  if (!(await requireMatic())) return;
  _withdraw.amount = 0;
  // Fetch fresh balances
  const provider = state.walletSigner?.provider || getFallbackProvider();
  const tokens = ['USDC','DAI','USDT','EURe','ZCHF'];
  const results = await Promise.allSettled(
    tokens.map(tk => new ethers.Contract(TOKEN_ADDRESSES[tk], ERC20_ABI, provider)
      .balanceOf(state.address).then(r => Number(ethers.formatUnits(r, TOKEN_DECIMALS[tk] || 6))))
  );
  let totalUsd = 0;
  _withdraw.balances = {};
  const listEl = document.getElementById('withdraw-token-list');
  listEl.innerHTML = '';
  tokens.forEach((tk, i) => {
    const val = results[i].status === 'fulfilled' ? results[i].value : 0;
    _withdraw.balances[tk] = val;
    totalUsd += val;
    if (val > 0.001) {
      const colors = { USDC:'#4ade80', DAI:'#facc15', USDT:'#34d399', EURe:'#60a5fa', ZCHF:'#f87171' };
      listEl.innerHTML += `<div style="display:flex;justify-content:space-between;align-items:center"><span style="color:${colors[tk]||'#94a3b8'};font-size:12px;font-weight:700">${tk}</span><span class="text-white text-xs font-semibold">${val.toFixed(2)}</span></div>`;
    }
  });
  _withdraw.totalUsd = totalUsd;
  document.getElementById('withdraw-total').textContent = '$' + totalUsd.toFixed(2);
  if (totalUsd < 0.01) {
    f7app.dialog.alert(t('withdraw.no_balance'), 'PiggyVault');
    return;
  }
  // Reset UI
  document.getElementById('withdraw-step1').classList.remove('hidden');
  document.getElementById('withdraw-step2').classList.add('hidden');
  document.getElementById('withdraw-step3-wallet').classList.add('hidden');
  document.getElementById('withdraw-consolidating').classList.add('hidden');
  document.getElementById('withdraw-amount-input').value = '';
  document.querySelectorAll('.withdraw-preset').forEach(b => { b.style.background = ''; b.style.borderColor = ''; });
  // Load bank details into settings fields (if open)
  _loadBankDetailsUI();
  App.openModal('modal-withdraw');
};

App.setWithdrawPercent = function(pct) {
  const val = (_withdraw.totalUsd * pct / 100);
  _withdraw.amount = val;
  document.getElementById('withdraw-amount-input').value = val.toFixed(2);
  document.querySelectorAll('.withdraw-preset').forEach(b => { b.style.background = ''; b.style.borderColor = ''; });
  if (event && event.currentTarget) {
    event.currentTarget.style.background = pct === 100 ? 'rgba(16,185,129,.25)' : 'rgba(59,130,246,.25)';
    event.currentTarget.style.borderColor = pct === 100 ? 'rgba(16,185,129,.5)' : 'rgba(59,130,246,.5)';
  }
  document.getElementById('withdraw-amount-hint').textContent = pct === 100 ? t('withdraw.full_balance') : `${pct}% ≈ $${val.toFixed(2)}`;
};

App.setWithdrawAmountCustom = function(val) {
  _withdraw.amount = parseFloat(val) || 0;
  document.querySelectorAll('.withdraw-preset').forEach(b => { b.style.background = ''; b.style.borderColor = ''; });
  if (_withdraw.amount > _withdraw.totalUsd) {
    document.getElementById('withdraw-amount-hint').textContent = t('withdraw.exceeds');
    document.getElementById('withdraw-amount-hint').style.color = '#f87171';
  } else {
    document.getElementById('withdraw-amount-hint').textContent = '';
    document.getElementById('withdraw-amount-hint').style.color = '';
  }
};

App.withdrawNext = function() {
  if (!_withdraw.amount || _withdraw.amount < 1) {
    document.getElementById('withdraw-amount-input').focus();
    document.getElementById('withdraw-amount-hint').textContent = t('withdraw.min_amount');
    document.getElementById('withdraw-amount-hint').style.color = '#f87171';
    return;
  }
  if (_withdraw.amount > _withdraw.totalUsd) {
    document.getElementById('withdraw-amount-hint').textContent = t('withdraw.exceeds');
    document.getElementById('withdraw-amount-hint').style.color = '#f87171';
    return;
  }
  document.getElementById('withdraw-amount-display').textContent = '$' + _withdraw.amount.toFixed(2);
  document.getElementById('withdraw-step1').classList.add('hidden');
  document.getElementById('withdraw-step2').classList.remove('hidden');
};

App.withdrawBack = function() {
  document.getElementById('withdraw-step1').classList.remove('hidden');
  document.getElementById('withdraw-step2').classList.add('hidden');
};

App.withdrawBackToStep2 = function() {
  document.getElementById('withdraw-step3-wallet').classList.add('hidden');
  document.getElementById('withdraw-step2').classList.remove('hidden');
};

// ─── Bank transfer (MT Pelerin sell widget) ─────────────────
App.withdrawToBank = async function() {
  haptic(15);
  // Hide steps, show consolidation spinner
  document.getElementById('withdraw-step2').classList.add('hidden');
  document.getElementById('withdraw-consolidating').classList.remove('hidden');
  const msgEl = document.getElementById('withdraw-consolidate-msg');
  const detailEl = document.getElementById('withdraw-consolidate-detail');

  try {
    // Consolidate all tokens into USDC
    msgEl.textContent = t('withdraw.consolidating');
    const usdcAddr = TOKEN_ADDRESSES.USDC;
    const usdcDec = TOKEN_DECIMALS.USDC;
    const tokensToSwap = ['DAI','USDT','EURe','ZCHF'];
    let totalUsdc = _withdraw.balances.USDC || 0;

    for (const tk of tokensToSwap) {
      const bal = _withdraw.balances[tk] || 0;
      if (bal < 0.01) continue;
      detailEl.textContent = `${tk} → USDC (${bal.toFixed(2)} ${tk})...`;
      try {
        const srcAddr = TOKEN_ADDRESSES[tk];
        const srcDec = TOKEN_DECIMALS[tk] || 18;
        const srcAmountRaw = ethers.parseUnits(bal.toFixed(srcDec > 6 ? 8 : 2), srcDec).toString();
        const route = await getSwapQuote(srcAddr, usdcAddr, srcAmountRaw, srcDec, usdcDec);
        const swapTxData = await buildSwapTx(route, state.address);
        // Approve
        const token = new ethers.Contract(srcAddr, ERC20_ABI, state.walletSigner);
        const approveTx = await token.approve(swapTxData.to, ethers.MaxUint256);
        await approveTx.wait();
        // Swap
        const tx = await state.walletSigner.sendTransaction({
          to: swapTxData.to, data: swapTxData.data,
          value: swapTxData.value || '0', gasLimit: swapTxData.gas || 500000n,
        });
        const rcpt = await tx.wait(); recordGasCost(rcpt);
        const received = Number(ethers.formatUnits(route.destAmount, usdcDec));
        totalUsdc += received;
      } catch(swapErr) {
        console.warn(`[Withdraw] Swap ${tk}→USDC failed:`, swapErr);
        // Skip this token, continue with what we have
      }
    }

    // Calculate how much USDC to sell (proportional to requested amount)
    let sellAmount = totalUsdc;
    if (_withdraw.amount < _withdraw.totalUsd * 0.99) {
      sellAmount = totalUsdc * (_withdraw.amount / _withdraw.totalUsd);
    }
    sellAmount = Math.min(sellAmount, totalUsdc);

    // Open MT Pelerin sell widget
    detailEl.textContent = '';
    msgEl.textContent = t('withdraw.opening_widget');

    await _openMtPelerinSell(sellAmount);

  } catch(err) {
    console.error('[Withdraw] Bank transfer flow failed:', err);
    f7app.dialog.alert(t('withdraw.error') + ': ' + (err.message || '').slice(0, 100), 'PiggyVault');
  } finally {
    document.getElementById('withdraw-consolidating').classList.add('hidden');
    document.getElementById('withdraw-step1').classList.remove('hidden');
    App.closeModal('modal-withdraw');
  }
};

async function _openMtPelerinSell(usdcAmount) {
  const mtpLangs = ['en','fr','de','it','es','pt'];
  const appLang = (typeof getAppLanguage === 'function') ? getAppLanguage() : 'en';
  const lang = mtpLangs.includes(appLang) ? appLang : 'en';
  const opts = {
    _ctkn: 'bb3ca0be-83a5-42a7-8e4f-5cb08892caf2',
    mode: 'dark',
    lang,
    tab: 'sell',
    tabs: 'sell',
    net: 'matic_mainnet',
    nets: 'matic_mainnet',
    ssc: 'USDC',
    sdc: 'EUR',
    crys: 'USDC',
    curs: 'EUR,CHF,USD,GBP',
    snet: 'matic_mainnet',
  };
  if (usdcAmount > 0) opts.ssa = String(Math.floor(usdcAmount * 100) / 100);
  // Sign address for validation
  if (state.address && state.walletSigner) {
    try {
      const code = String(Math.floor(Math.random() * 9000) + 1000);
      const message = 'MtPelerin-' + code;
      const sigHex = await state.walletSigner.signMessage(message);
      const sigBytes = ethers.getBytes(sigHex);
      const hash = btoa(String.fromCharCode.apply(null, sigBytes));
      opts.addr = state.address;
      opts.code = code;
      opts.hash = hash;
    } catch(e) { console.warn('[MtPelerin] Sell address signing failed:', e); }
  }
  const buildUrl = (o) => {
    const url = new URL('https://widget.mtpelerin.com/');
    Object.keys(o).forEach(k => url.searchParams.set(k, o[k]));
    return url.toString();
  };
  if (typeof showMtpModal !== 'function') {
    opts.type = 'direct-link';
    window.open(buildUrl(opts), '_blank');
    return;
  }
  setTimeout(() => {
    opts.type = 'web';
    const existing = document.getElementById('MtPelerinModal');
    if (existing) {
      const iframe = existing.querySelector('.mtp-iframe');
      if (iframe) { iframe.src = buildUrl(opts); _patchMtpIframeAllow(iframe); }
      existing.style.display = 'block';
    } else {
      showMtpModal(opts);
      setTimeout(_patchMtpIframeAllowAll, 500);
    }
  }, 350);
}

// ─── Send to wallet ─────────────────────────────────────────
App.withdrawToWallet = function() {
  haptic(15);
  document.getElementById('withdraw-step2').classList.add('hidden');
  document.getElementById('withdraw-step3-wallet').classList.remove('hidden');
  // Populate token selector
  const sel = document.getElementById('withdraw-send-token');
  sel.innerHTML = '';
  const tokens = ['USDC','DAI','USDT','EURe','ZCHF'];
  tokens.forEach(tk => {
    const bal = _withdraw.balances[tk] || 0;
    if (bal > 0.001) {
      const opt = document.createElement('option');
      opt.value = tk;
      opt.textContent = `${tk} — ${bal.toFixed(2)}`;
      sel.appendChild(opt);
    }
  });
  App.onWithdrawTokenChange();
  document.getElementById('withdraw-send-amount').value = '';
  document.getElementById('withdraw-send-addr').value = '';
  document.getElementById('withdraw-addr-hint').textContent = '';
  document.getElementById('withdraw-send-status').textContent = '';
  document.getElementById('withdraw-send-btn').disabled = true;
};

App.onWithdrawTokenChange = function() {
  const tk = document.getElementById('withdraw-send-token').value;
  const bal = _withdraw.balances[tk] || 0;
  document.getElementById('withdraw-send-balance').textContent = t('withdraw.balance_label', {balance: bal.toFixed(4), token: tk});
};

App.withdrawSendMax = function() {
  const tk = document.getElementById('withdraw-send-token').value;
  const bal = _withdraw.balances[tk] || 0;
  document.getElementById('withdraw-send-amount').value = bal.toFixed(TOKEN_DECIMALS[tk] > 6 ? 8 : 4);
};

App.validateWithdrawAddr = function(val) {
  const hint = document.getElementById('withdraw-addr-hint');
  const btn = document.getElementById('withdraw-send-btn');
  if (!val || val.length < 3) {
    hint.textContent = '';
    btn.disabled = true;
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(val)) {
    hint.textContent = t('withdraw.invalid_address');
    hint.style.color = '#f87171';
    btn.disabled = true;
    return;
  }
  if (val.toLowerCase() === (state.address || '').toLowerCase()) {
    hint.textContent = t('withdraw.same_address');
    hint.style.color = '#fbbf24';
    btn.disabled = true;
    return;
  }
  hint.textContent = t('withdraw.valid_address');
  hint.style.color = '#4ade80';
  btn.disabled = false;
};

App.executeWalletTransfer = async function() {
  const tk = document.getElementById('withdraw-send-token').value;
  const amount = parseFloat(document.getElementById('withdraw-send-amount').value);
  const dest = document.getElementById('withdraw-send-addr').value.trim();
  const statusEl = document.getElementById('withdraw-send-status');
  const btn = document.getElementById('withdraw-send-btn');

  if (!tk || !amount || amount <= 0 || !dest) {
    statusEl.textContent = t('withdraw.fill_all');
    statusEl.style.color = '#f87171';
    return;
  }
  const bal = _withdraw.balances[tk] || 0;
  if (amount > bal) {
    statusEl.textContent = t('withdraw.insufficient', {token: tk});
    statusEl.style.color = '#f87171';
    return;
  }
  // Double confirmation
  const confirmed = await new Promise(resolve => {
    f7app.dialog.confirm(
      t('withdraw.confirm_send', {amount: amount.toFixed(4), token: tk, addr: dest.slice(0,8) + '…' + dest.slice(-6)}),
      'PiggyVault',
      () => resolve(true),
      () => resolve(false)
    );
  });
  if (!confirmed) return;

  btn.disabled = true;
  statusEl.textContent = t('withdraw.sending');
  statusEl.style.color = '#fbbf24';
  try {
    const dec = TOKEN_DECIMALS[tk] || 6;
    const units = ethers.parseUnits(amount.toString(), dec);
    const contract = new ethers.Contract(TOKEN_ADDRESSES[tk], ERC20_ABI, state.walletSigner);
    const tx = await contract.transfer(dest, units);
    statusEl.textContent = t('withdraw.confirming_tx');
    const rcpt = await tx.wait();
    recordGasCost(rcpt);
    statusEl.innerHTML = `<span style="color:#4ade80">${t('withdraw.sent_ok')}</span>`;
    haptic(30);
    setTimeout(() => {
      App.closeModal('modal-withdraw');
      refreshWalletBalance(false);
    }, 2000);
  } catch(err) {
    statusEl.textContent = '❌ ' + (err.reason || err.shortMessage || err.message || t('common.error')).slice(0, 100);
    statusEl.style.color = '#f87171';
    btn.disabled = false;
  }
};

// ─── Bank details (settings) ────────────────────────────────
function _isValidIban(iban) {
  if (!iban) return false;
  iban = iban.replace(/\s/g, '').toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
  // Basic IBAN checksum validation (mod 97)
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numStr = rearranged.split('').map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 ? String(code - 55) : c;
  }).join('');
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
  }
  return remainder === 1;
}

App.saveBankDetails = function() {
  const name = (document.getElementById('settings-bank-name')?.value || '').trim();
  const iban = (document.getElementById('settings-bank-iban')?.value || '').trim().replace(/\s/g, '').toUpperCase();
  localStorage.setItem(STORAGE.BANK_NAME, name);
  localStorage.setItem(STORAGE.BANK_IBAN, iban);
  _updateBankStatusUI(name, iban);
};

function _updateBankStatusUI(name, iban) {
  const statusEl = document.getElementById('settings-bank-status');
  const hintEl = document.getElementById('settings-iban-hint');
  const ibanInput = document.getElementById('settings-bank-iban');
  if (!statusEl) return;
  const hasName = name && name.length >= 2;
  const validIban = _isValidIban(iban);
  if (hasName && validIban) {
    statusEl.textContent = t('settings.bank_ok');
    statusEl.style.background = 'rgba(16,185,129,.15)';
    statusEl.style.color = '#34d399';
  } else if (!iban && !name) {
    statusEl.textContent = t('settings.bank_empty');
    statusEl.style.background = 'rgba(239,68,68,.1)';
    statusEl.style.color = '#f87171';
  } else {
    statusEl.textContent = t('settings.bank_incomplete');
    statusEl.style.background = 'rgba(251,191,36,.1)';
    statusEl.style.color = '#fbbf24';
  }
  if (hintEl) {
    if (!iban) { hintEl.textContent = ''; hintEl.style.color = ''; }
    else if (validIban) { hintEl.textContent = '✓ IBAN ' + t('withdraw.valid_address'); hintEl.style.color = '#4ade80'; }
    else { hintEl.textContent = '✗ IBAN ' + t('withdraw.invalid_address'); hintEl.style.color = '#f87171'; }
  }
  if (ibanInput) {
    ibanInput.style.borderColor = !iban ? '' : validIban ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)';
  }
}

function _loadBankDetailsUI() {
  const name = localStorage.getItem(STORAGE.BANK_NAME) || '';
  const iban = localStorage.getItem(STORAGE.BANK_IBAN) || '';
  const nameInput = document.getElementById('settings-bank-name');
  const ibanInput = document.getElementById('settings-bank-iban');
  if (nameInput) nameInput.value = name;
  if (ibanInput) ibanInput.value = iban;
  _updateBankStatusUI(name, iban);
}

// ─── Bug Report ───────────────────────────────────────────────
App.sendBugReport = function() {
  const subject = (document.getElementById('bug-subject')?.value || '').trim();
  const body = (document.getElementById('bug-body')?.value || '').trim();
  if (!body) {
    f7app.dialog.alert(t('settings.bug_empty'), 'PiggyVault');
    return;
  }
  const meta = '\\n\\n---\\nVersion: ' + APP_VERSION + '\\nAddress: ' + (state.address || 'N/A') + '\\nUA: ' + navigator.userAgent;
  const mailSubject = encodeURIComponent(subject || 'Bug Report — PiggyVault');
  const mailBody = encodeURIComponent(body + meta);
  window.open('mailto:info@piggywallet.xyz?subject=' + mailSubject + '&body=' + mailBody, '_self');
  // Clear form
  if (document.getElementById('bug-subject')) document.getElementById('bug-subject').value = '';
  if (document.getElementById('bug-body')) document.getElementById('bug-body').value = '';
};

const _onramp = { amount: 0 };

App.openOnramp = async function() {
  // Block if no MATIC at all
  if (!(await requireMatic())) return;

  _onramp.amount = 0;
  document.getElementById('onramp-step1').classList.remove('hidden');
  document.getElementById('onramp-step2').classList.add('hidden');
  // Reset self-send state: hide panel and re-show all step2 elements
  document.getElementById('onramp-self-send')?.classList.add('hidden');
  ['onramp-choose-text', 'onramp-providers', 'onramp-provider-notice', 'onramp-next-steps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });
  document.getElementById('onramp-subtitle').textContent = 'Scegli quanto vuoi ricaricare.';
  document.getElementById('onramp-amount-input').value = '';
  document.querySelectorAll('.onramp-preset').forEach(b => b.classList.remove('bg-blue-600','border-blue-500'));
  document.getElementById('onramp-refresh-msg')?.classList.add('hidden');
  // Populate self-send address
  const selfAddr = document.getElementById('onramp-self-addr');
  if (selfAddr && state.address) selfAddr.textContent = state.address;
  updateOnrampNoticeVisibility();
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
  const mtpLabel = document.getElementById('onramp-label-mtpelerin');
  if (mtpLabel) mtpLabel.textContent = label;
  document.getElementById('onramp-subtitle').textContent = t('onramp.recharge_about', {amount: amt});
  document.getElementById('onramp-step1').classList.add('hidden');
  document.getElementById('onramp-step2').classList.remove('hidden');
  document.getElementById('onramp-refresh-msg')?.classList.add('hidden');
  updateOnrampNoticeVisibility();
};

App.onrampBack = function() {
  document.getElementById('onramp-step1').classList.remove('hidden');
  document.getElementById('onramp-step2').classList.add('hidden');
  document.getElementById('onramp-subtitle').textContent = t('onramp.choose_how_much');
};

App.refreshAfterOnramp = async function() {
  const msgs = ['onramp-refresh-msg', 'onramp-self-send-msg']
    .map(id => document.getElementById(id)).filter(Boolean);
  if (!msgs.length) return;
  const setMsg = (txt) => msgs.forEach(m => { m.classList.remove('hidden'); m.textContent = txt; });
  const setHtml = (html) => msgs.forEach(m => { m.classList.remove('hidden'); m.innerHTML = html; });

  setMsg(t('onramp.checking'));

  try {
    const provider = state.walletSigner?.provider || getFallbackProvider();

    // Fetch current balances
    const polNow = Number(ethers.formatEther(await provider.getBalance(state.address)));
    const tokens = ['USDC','DAI','USDT','EURe','ZCHF'];
    const results = await Promise.allSettled(
      tokens.map(t => new ethers.Contract(TOKEN_ADDRESSES[t], ERC20_ABI, provider)
        .balanceOf(state.address).then(r => Number(ethers.formatUnits(r, TOKEN_DECIMALS[t] || 6))))
    );
    const stableNow = results.reduce((s, r) => s + (r.status === 'fulfilled' ? r.value : 0), 0);

    // Compare to snapshot
    const polDelta = polNow - _selfSend.polBefore;
    const stableDelta = stableNow - _selfSend.stableBefore;

    if (polDelta < 0.001 && stableDelta < 0.01) {
      setMsg(t('onramp.no_deposit'));
      return;
    }

    // Stablecoins arrived — just update
    if (stableDelta >= 0.01) {
      await refreshWalletBalance(false);
      await renderDashboard();
      setMsg(t('onramp.stablecoin_received', {amount: stableDelta.toFixed(2)}));
    }

    // POL arrived — check if excess needs swapping
    if (polDelta >= 0.01) {
      const excess = polNow - POL_KEEP;
      if (excess > 0.5 && state.walletSigner) {
        setHtml(t('onramp.pol_converting', {polDelta: polDelta.toFixed(2), keep: POL_KEEP, excess: excess.toFixed(2)}));
        try {
          const excessWei = ethers.parseEther(excess.toFixed(6)).toString();
          const route = await getSwapQuote(NATIVE_TOKEN, TOKEN_ADDRESSES.USDC, excessWei, 18, 6);
          const swapTx = await buildSwapTx(route, state.address);
          const tx = await state.walletSigner.sendTransaction({
            to: swapTx.to, data: swapTx.data,
            value: swapTx.value || excessWei,
            gasLimit: swapTx.gas || 400000n,
          });
          setHtml(t('onramp.converting'));
          const rcpt0 = await tx.wait(); recordGasCost(rcpt0);
          await refreshWalletBalance(false);
          await renderDashboard();
          const usdcReceived = Number(ethers.formatUnits(route.destAmount, 6));
          setHtml(t('onramp.conversion_done', {keep: POL_KEEP, usdc: usdcReceived.toFixed(2)}));
        } catch(swapErr) {
          console.warn('[SelfSend] POL→USDC swap failed:', swapErr);
          await refreshWalletBalance(false);
          await renderDashboard();
          setHtml(t('onramp.conversion_failed', {polDelta: polDelta.toFixed(2), error: (swapErr.reason || swapErr.message || '').slice(0,60)}));
        }
      } else if (excess <= 0.5) {
        await refreshWalletBalance(false);
        await renderDashboard();
        setMsg(t('onramp.pol_received_ok', {polDelta: polDelta.toFixed(2)}));
      } else {
        setMsg(t('onramp.pol_connect_convert', {polDelta: polDelta.toFixed(2)}));
      }
    }

    // Update snapshot for next check
    _selfSend.polBefore = polNow > POL_KEEP ? POL_KEEP : polNow;
    _selfSend.stableBefore = stableNow;

  } catch(err) {
    console.warn('[SelfSend] refresh failed:', err);
    setMsg(t('onramp.refresh_error'));
  }
};

App.copyOnrampAddress = async function() {
  haptic(15);
  if (navigator.share) {
    try { await navigator.share({ title: t('onramp.share_title'), text: state.address || '' }); return; } catch(e) { /* user cancelled or unsupported, fall back */ }
  }
  navigator.clipboard.writeText(state.address || '');
  document.getElementById('onramp-copied').classList.remove('hidden');
  setTimeout(() => document.getElementById('onramp-copied').classList.add('hidden'), 2000);
};

App.dismissInstallBanner = function() {
  localStorage.setItem(STORAGE.INSTALL_BANNER_HIDE, '1');
  updateInstallBanner();
};

App.installApp = async function() {
  if (!state.deferredInstallPrompt) return;
  const promptEvent = state.deferredInstallPrompt;
  state.deferredInstallPrompt = null;
  promptEvent.prompt();
  try {
    await promptEvent.userChoice;
  } catch {
    // no-op
  }
  updateInstallBanner();
};

// ─── Mt Pelerin iframe patching (Apple Pay + payment permissions) ─
function _patchMtpIframeAllow(iframe) {
  if (!iframe) return;
  const perms = 'payment; camera; microphone; clipboard-write; clipboard-read';
  if (iframe.getAttribute('allow') !== perms) {
    iframe.setAttribute('allow', perms);
    iframe.setAttribute('allowpaymentrequest', 'true');
    console.log('[MtPelerin] iframe patched with allow="payment"');
  }
}
function _patchMtpIframeAllowAll() {
  const modal = document.getElementById('MtPelerinModal');
  if (!modal) return;
  modal.querySelectorAll('iframe').forEach(f => _patchMtpIframeAllow(f));
  // Also observe for dynamically added iframes
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach(n => {
        if (n.tagName === 'IFRAME') _patchMtpIframeAllow(n);
        if (n.querySelectorAll) n.querySelectorAll('iframe').forEach(f => _patchMtpIframeAllow(f));
      });
    }
  });
  obs.observe(modal, { childList: true, subtree: true });
  // Auto-disconnect after 10s
  setTimeout(() => obs.disconnect(), 10000);
}

App.openMtPelerin = async function() {
  closeModal('modal-onramp');
  const mtpLangs = ['en','fr','de','it','es','pt'];
  const appLang = (typeof getAppLanguage === 'function') ? getAppLanguage() : 'en';
  const lang = mtpLangs.includes(appLang) ? appLang : 'en';
  const baseOpts = {
    _ctkn: 'bb3ca0be-83a5-42a7-8e4f-5cb08892caf2',
    mode: 'dark',
    lang,
    tab: 'buy',
    tabs: 'buy',
    net: 'matic_mainnet',
    nets: 'matic_mainnet',
    bsc: 'EUR',
    bdc: 'USDC',
    crys: 'USDC,DAI,USDT,POL',
  };
  if (_onramp.amount) baseOpts.bsa = String(_onramp.amount);
  if (state.address && state.walletSigner) {
    try {
      const code = String(Math.floor(Math.random() * 9000) + 1000);
      const message = 'MtPelerin-' + code;
      const sigHex = await state.walletSigner.signMessage(message);
      const sigBytes = ethers.getBytes(sigHex);
      const hash = btoa(String.fromCharCode.apply(null, sigBytes));
      baseOpts.addr = state.address;
      baseOpts.code = code;
      baseOpts.hash = hash;
    } catch (e) {
      console.warn('[MtPelerin] Address signing failed, skipping addr param:', e);
    }
  }
  const buildMtpUrl = (opts) => {
    const url = new URL('https://widget.mtpelerin.com/');
    Object.keys(opts).forEach(k => url.searchParams.set(k, opts[k]));
    return url.toString();
  };
  if (typeof showMtpModal !== 'function') {
    baseOpts.type = 'direct-link';
    window.open(buildMtpUrl(baseOpts), '_blank');
    return;
  }
  setTimeout(() => {
    baseOpts.type = 'web';
    const existing = document.getElementById('MtPelerinModal');
    if (existing) {
      const iframe = existing.querySelector('.mtp-iframe');
      if (iframe) { iframe.src = buildMtpUrl(baseOpts); _patchMtpIframeAllow(iframe); }
      existing.style.display = 'block';
    } else {
      showMtpModal(baseOpts);
      setTimeout(_patchMtpIframeAllowAll, 500);
    }
  }, 350);
};


App.openTransak = function() {
  window.open('https://global.transak.com/', '_blank');
};

function renderDashboard() {
  const vaults = state.vaults;
  const lockedTotal = vaults.filter(v => !isVaultUnlocked(v) && !v.withdrawn).reduce((s, v) => s + vaultTotal(v), 0);
  const unlockedTotal = vaults.filter(v => isVaultUnlocked(v) && !v.withdrawn).reduce((s, v) => s + vaultTotal(v), 0);
  const cur = getDisplayCurrency();
  document.getElementById('stat-total').textContent = fmtDisplayAmount(lockedTotal);
  const statCurEl = document.getElementById('stat-currency');
  if (statCurEl) statCurEl.textContent = currencySymbol(cur);
  const unlockedRow = document.getElementById('stat-unlocked-row');
  const unlockedEl = document.getElementById('stat-unlocked');
  if (unlockedRow && unlockedEl) {
    if (unlockedTotal > 0) { unlockedRow.classList.remove('hidden'); unlockedEl.textContent = fmtDisplayAmount(unlockedTotal); }
    else { unlockedRow.classList.add('hidden'); }
  }
  document.getElementById('stat-vaults').textContent = `(${vaults.length})`;
  const beginnerBanner = document.getElementById('beginner-start-banner');
  if (beginnerBanner) {
    if (lockedTotal <= 0 && vaults.length === 0) beginnerBanner.classList.remove('hidden');
    else beginnerBanner.classList.add('hidden');
  }
  updateInstallBanner();
  updateGasCard();
  updateDonateSymbols();

  const locked = vaults.filter(v => !isVaultUnlocked(v));
  if (locked.length) {
    const withDate = locked.filter(v => v.unlockDate).sort((a,b) => new Date(a.unlockDate)-new Date(b.unlockDate));
    const next = withDate.length ? withDate[0] : locked[0];
    document.getElementById('stat-next-unlock').innerHTML = renderVaultIcon(next.icon, 16, false) + ' ' + (next.name || t('common.vault'));
    if (next.unlockDate) {
      const d = daysUntil(next.unlockDate);
      document.getElementById('stat-days-left').textContent = t('dash.days', {d: d});
    } else {
      const remaining = Math.max(0, next.target - vaultTotal(next));
      document.getElementById('stat-days-left').textContent = t('detail.to_reach', {amount: remaining.toFixed(0), currency: next.currency});
    }
  } else if (vaults.length) {
    document.getElementById('stat-next-unlock').textContent = t('dash.all_open');
    document.getElementById('stat-days-left').textContent = '';
  } else {
    document.getElementById('stat-next-unlock').textContent = '—';
    document.getElementById('stat-days-left').textContent = t('dash.no_vaults');
  }

  // Show/hide quick action buttons
  const quickActions = document.getElementById('home-quick-actions');
  if (quickActions) {
    if (vaults.length > 0) { quickActions.classList.remove('hidden'); quickActions.style.display = 'grid'; }
    else { quickActions.classList.add('hidden'); quickActions.style.display = 'none'; }
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

let _vaultFilter = 'all';

App.filterVaults = function(filter) {
  haptic(10);
  _vaultFilter = filter;
  document.querySelectorAll('#vault-filters .vault-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.filter === filter);
  });
  renderVaultCards();
};

function _buildFilterChips() {
  const fc = document.getElementById('vault-filters');
  if (!fc) return;
  fc.innerHTML = '';
  const all = state.vaults || [];
  if (all.length === 0) return;
  const hasActive = all.some(v => !isVaultUnlocked(v) && !v.withdrawn);
  const hasUnlocked = all.some(v => isVaultUnlocked(v) && !v.withdrawn);
  const hasWithdrawn = all.some(v => v.withdrawn);
  const hasAave = all.some(v => v.strategy === 'aave' || v.onChainContract === 'aave');
  const chips = [{ key:'all', label: t('filter.all') }];
  if (hasActive) chips.push({ key:'active', label: t('filter.active') });
  if (hasUnlocked) chips.push({ key:'unlocked', label: t('filter.unlocked') });
  if (hasWithdrawn) chips.push({ key:'withdrawn', label: t('filter.withdrawn') });
  if (hasAave) chips.push({ key:'aave', label: t('filter.aave') });
  if (chips.length <= 1) return;
  if (!chips.find(c => c.key === _vaultFilter)) _vaultFilter = 'all';
  chips.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'vault-chip' + (c.key === _vaultFilter ? ' active' : '');
    btn.dataset.filter = c.key;
    btn.textContent = c.label;
    btn.onclick = () => App.filterVaults(c.key);
    fc.appendChild(btn);
  });
}

function renderVaultCards() {
  const grid = document.getElementById('vaults-grid');
  grid.querySelectorAll('.vault-card').forEach(c => c.remove());
  const all = state.vaults || [];

  _buildFilterChips();

  let vaults = all;
  if (_vaultFilter === 'active') vaults = all.filter(v => !isVaultUnlocked(v) && !v.withdrawn);
  else if (_vaultFilter === 'unlocked') vaults = all.filter(v => isVaultUnlocked(v) && !v.withdrawn);
  else if (_vaultFilter === 'withdrawn') vaults = all.filter(v => v.withdrawn);
  else if (_vaultFilter === 'aave') vaults = all.filter(v => v.strategy === 'aave' || v.onChainContract === 'aave');

  const emptyEl = document.getElementById('empty-vaults');
  if (!all.length) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');
  if (!vaults.length) { _vaultFilter = 'all'; vaults = all; _buildFilterChips(); }

  vaults.forEach((vault, idx) => {
    const total = vaultTotal(vault);
    const pct = vault.target ? Math.min((total / vault.target) * 100, 100) : 0;
    const unlocked = isVaultUnlocked(vault);
    const mode = vault.unlockMode ?? 0;
    const isAave = vault.strategy === 'aave' || vault.onChainContract === 'aave';
    const vColor = vault.color || '#3b82f6';
    let statusHtml = '';
    if (vault.withdrawn) {
      statusHtml = '<span style="color:#4ade80"><i class="f7-icons" style="font-size:10px;vertical-align:middle">checkmark_circle_fill</i> ' + t('card.withdrawn') + '</span>';
    } else if (unlocked) {
      statusHtml = '<span style="color:#4ade80"><i class="f7-icons" style="font-size:10px;vertical-align:middle">lock_open_fill</i> ' + t('card.to_withdraw') + '</span>';
    } else if (mode === 0) {
      statusHtml = '<span style="color:#60a5fa"><i class="f7-icons" style="font-size:10px;vertical-align:middle">lock_fill</i> ' + daysUntil(vault.unlockDate) + 'g</span>';
    } else if (mode === 1) {
      const rem = Math.max(0, vault.target - total);
      statusHtml = '<span style="color:#60a5fa"><i class="f7-icons" style="font-size:10px;vertical-align:middle">lock_fill</i> ' + rem.toFixed(0) + ' ' + vault.currency + '</span>';
    } else {
      const d = vault.unlockDate ? daysUntil(vault.unlockDate) : Infinity;
      const rem = vault.target ? Math.max(0, vault.target - total) : Infinity;
      statusHtml = '<span style="color:#60a5fa"><i class="f7-icons" style="font-size:10px;vertical-align:middle">lock_fill</i> ' + (d < Infinity ? d+'g' : '') + (rem > 0 && rem < Infinity ? ' / '+rem.toFixed(0) : '') + '</span>';
    }
    const aaveBadge = isAave ? '<span style="font-size:8px;background:rgba(16,185,129,.15);color:#34d399;padding:1px 5px;border-radius:6px;font-weight:600;display:inline-block;margin-top:2px"><i class="f7-icons" style="font-size:8px;vertical-align:middle">arrow_up_right</i> Aave</span>' : '';
    const interestLine = isAave && vault._aaveEarnedInterest > 0
      ? '<div style="font-size:9px;color:#34d399;margin-top:1px">+' + vault._aaveEarnedInterest.toFixed(4) + '</div>' : '';
    const targetFmt = vault.target ? '/ ' + Number(vault.target).toFixed(2) : '';

    const card = document.createElement('div');
    card.className = 'vault-card';
    card.style.setProperty('--vault-glow', vColor);
    card.style.animationDelay = (idx * 60) + 'ms';
    card.onclick = () => { haptic(15); App.openVaultDetail(vault.id); };
    card.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span class="vc-icon">${renderVaultIcon(vault.icon, 32, true)}</span>
          <span class="vc-currency">${vault.currency}</span>
        </div>
        <div class="vc-name">${vault.name}</div>
        <div class="vc-status">${statusHtml}</div>
        ${aaveBadge}
      </div>
      <div>
        ${interestLine}
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px">
          <span class="vc-amount" style="color:#e2e8f0">${total.toFixed(2)}</span>
          <span class="vc-meta">${targetFmt}</span>
        </div>
        <div class="vc-bar">
          <div class="vc-bar-fill" style="width:${Math.max(pct, 2)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:3px">
          <span class="vc-meta">${pct.toFixed(0)}%</span>
          <span class="vc-meta">${vault.unlockDate ? fmtDateShort(vault.unlockDate) : ''}</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

// ─── Extra Stats (Statistiche tab) ───────────────────────────
function renderExtraStats() {
  const cur = getDisplayCurrency();
  const sym = currencySymbol(cur);
  const vaults = state.vaults || [];
  const activeVaults = vaults.filter(v => !v.deleted);
  // Total deposited (sum of all tx amounts across all vaults — amounts are in stablecoins ≈ USD)
  let totalDeposited = 0, depositCount = 0;
  activeVaults.forEach(v => {
    (v.transactions || []).forEach(tx => {
      if (tx.amount > 0) { totalDeposited += tx.amount; depositCount++; }
    });
  });
  const avgPerVault = activeVaults.length > 0 ? totalDeposited / activeVaults.length : 0;
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('stats-total-deposited', fmtDisplayAmount(totalDeposited));
  el('stats-total-deposited-cur', sym);
  el('stats-deposit-count', String(depositCount));
  el('stats-avg-per-vault', fmtDisplayAmount(avgPerVault));
  el('stats-avg-per-vault-cur', sym);
  el('stats-active-vaults', String(activeVaults.length));
  // Unlock timeline
  const timeline = document.getElementById('stats-unlock-timeline');
  if (!timeline) return;
  const upcoming = activeVaults
    .filter(v => v.unlockMode === 0 && v.unlockDate && new Date(v.unlockDate) > new Date())
    .sort((a, b) => new Date(a.unlockDate) - new Date(b.unlockDate));
  if (upcoming.length === 0) {
    timeline.innerHTML = '';
    return;
  }
  timeline.innerHTML = upcoming.map(v => {
    const d = new Date(v.unlockDate);
    const days = Math.ceil((d - new Date()) / 86400000);
    const total = vaultTotal(v);
    return `<div class="flex justify-between items-center bg-slate-800/40 rounded-lg px-3 py-2">
      <div class="flex items-center gap-2"><span class="flex items-center">${renderVaultIcon(v.icon || '💰', 20, true)}</span><span class="font-medium text-white text-xs">${v.name || t('common.vault')}</span>
      <span class="text-slate-500 text-[10px] ml-1">${days}g</span></div>
      <span class="text-xs font-semibold">${sym}${fmtDisplayAmount(total)}</span>
    </div>`;
  }).join('');
}

// ─── Vault CRUD ──────────────────────────────────────────────
App.showNewVaultModal = async function() {
  // Block if no MATIC at all
  if (!(await requireMatic())) return;

  document.getElementById('vault-name').value = '';
  document.getElementById('vault-target').value = '';
  document.getElementById('vault-currency').value = 'USDC';
  // Date field: start empty, set min to tomorrow
  const dateInput = document.getElementById('vault-date');
  dateInput.value = '';
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);
  dateInput.min = toLocalDatetimeString(tomorrow);
  // Show timezone label
  const tzLabel = document.getElementById('vault-tz-label');
  if (tzLabel) tzLabel.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
  document.getElementById('vault-error').classList.add('hidden');
  state.selectedPreset = PRESETS[9];
  state.selectedUnlockMode = 0;
  state.selectedStrategy = 'base';
  App.setUnlockMode(0);
  App.setVaultStrategy('base');
  App._updateStrategyAvailability();
  const targetCurrSuffix = document.getElementById('vault-target-currency');
  if (targetCurrSuffix) targetCurrSuffix.textContent = stablecoinToFiat(document.getElementById('vault-currency').value);
  renderIconPicker();
  // Update strategy availability when currency changes
  document.getElementById('vault-currency').onchange = () => { App._updateStrategyAvailability(); const cs = document.getElementById('vault-target-currency'); if (cs) cs.textContent = stablecoinToFiat(document.getElementById('vault-currency').value); };
  openModal('modal-new-vault');
};

function renderIconPicker() {
  document.getElementById('icon-picker').innerHTML = PRESETS.map((p,i) => `
    <button onclick="App.selectPreset(${i})" title="${p.name}"
      class="flex flex-col items-center p-2 rounded-xl border-2 transition-all
      ${state.selectedPreset.icon===p.icon ? 'border-blue-500 bg-blue-500/15':'border-slate-700 hover:border-slate-500'}">
      ${renderVaultIcon(p.icon, 36, true)}
      <span class="text-xs text-slate-400 mt-1 truncate w-full text-center">${p.name}</span>
    </button>`).join('');
  document.getElementById('vault-name').placeholder = `es. ${state.selectedPreset.name}`;
}

App.selectPreset = function(i) {
  state.selectedPreset = PRESETS[i];
  document.getElementById('vault-name').value = PRESETS[i].name;
  renderIconPicker();
};

// ─── Strategy Selector ────────────────────────────────────────
App.setVaultStrategy = function(strategy) {
  state.selectedStrategy = strategy;
  document.querySelectorAll('.strategy-btn').forEach(btn => {
    btn.style.border = '2px solid rgba(51,65,85,.6)';
    btn.style.background = 'transparent';
    btn.style.color = '#64748b';
  });
  const active = document.getElementById(`strategy-btn-${strategy}`);
  if (active) {
    active.style.border = '2px solid #3b82f6';
    active.style.background = 'rgba(59,130,246,.1)';
    active.style.color = '#60a5fa';
  }
  const disclaimer = document.getElementById('strategy-aave-disclaimer');
  if (disclaimer) disclaimer.classList.toggle('hidden', strategy !== 'aave');
};

App._updateStrategyAvailability = function() {
  const currency = document.getElementById('vault-currency').value;
  const aaveSupported = AAVE_SUPPORTED_TOKENS.includes(currency);
  const aaveBtn = document.getElementById('strategy-btn-aave');
  const noAaveWarn = document.getElementById('strategy-noaave-warning');
  if (!aaveBtn) return;
  if (!aaveSupported) {
    aaveBtn.disabled = true;
    aaveBtn.style.opacity = '0.4';
    aaveBtn.style.cursor = 'not-allowed';
    if (noAaveWarn) noAaveWarn.classList.remove('hidden');
    if (state.selectedStrategy === 'aave') App.setVaultStrategy('base');
  } else {
    aaveBtn.disabled = false;
    aaveBtn.style.opacity = '1';
    aaveBtn.style.cursor = 'pointer';
    if (noAaveWarn) noAaveWarn.classList.add('hidden');
  }
};

App.createVault = async function() {
  const name = document.getElementById('vault-name').value.trim();
  const currency = document.getElementById('vault-currency').value;
  const mode = state.selectedUnlockMode;
  const needsDate   = mode === 0 || mode === 2 || mode === 3;
  const needsTarget = mode === 1 || mode === 2 || mode === 3;

  if (!name) return showError('vault-error', t('vault.error_name'));
  if (!currency) return showError('vault-error', t('vault.error_currency'));
  if (!state.walletSigner) return showError('vault-error', t('vault.error_wallet'));

  // Check for zero MATIC → show onboarding modal
  if (!(await requireMatic())) return;

  let target = 0;
  if (needsTarget) {
    target = parseFloat(document.getElementById('vault-target').value);
    if (!target || target <= 0) return showError('vault-error', t('vault.error_target'));
  }

  let unlockDate = null;
  if (needsDate) {
    unlockDate = document.getElementById('vault-date').value;
    if (!unlockDate) return showError('vault-error', t('vault.error_date'));
    const parsed = parseDateInput(unlockDate);
    if (!parsed || isNaN(parsed)) return showError('vault-error', t('vault.error_date_invalid'));
    if (parsed <= new Date()) return showError('vault-error', t('vault.error_date_future'));
  }

  // Gas check (low but not zero)
  const maticBal = await getMaticBalance();
  if (maticBal !== null && maticBal < 0.002) {
    return showError('vault-error', t('vault.error_matic', {bal: maticBal.toFixed(4)}));
  }

  // Determine strategy: force 'base' if currency not supported by Aave
  const strategy = (state.selectedStrategy === 'aave' && AAVE_SUPPORTED_TOKENS.includes(currency))
    ? 'aave' : 'base';

  const isAave = strategy === 'aave';
  const contractAddr = isAave ? CAVEAU_AAVE_CONTRACT : CAVEAU_CONTRACT;
  const contractAbi  = isAave ? CAVEAU_AAVE_ABI : CAVEAU_ABI;
  const tokenAddr = TOKEN_ADDRESSES[currency];
  const decimals  = TOKEN_DECIMALS[currency] || 6;

  // Disable button and show progress
  const createBtn = document.querySelector('#modal-new-vault button[onclick*="createVault"]');
  if (createBtn) { createBtn.disabled = true; createBtn.innerHTML = t('vault.btn_creating'); }
  showError('vault-error', ''); // clear previous errors
  document.getElementById('vault-error').classList.add('hidden');

  try {
    const caveau = new ethers.Contract(contractAddr, contractAbi, state.walletSigner);
    const targetUnits = target ? ethers.parseUnits(target.toString(), decimals) : 0n;
    const unlockTs = unlockDate
      ? Math.floor(parseDateInput(unlockDate).getTime() / 1000)
      : 0;
    const icon = state.selectedPreset.icon;

    // Send on-chain transaction
    showError('vault-error', '');
    const statusEl = document.getElementById('vault-error');
    statusEl.textContent = t('vault.creating');
    statusEl.className = 'text-sm text-yellow-400 text-center mt-2';
    statusEl.classList.remove('hidden');

    const txPromise = caveau.createVault(tokenAddr, targetUnits, unlockTs, mode, name, icon);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(t('vault.timeout'))), 60000));
    const createTx = await Promise.race([txPromise, timeout]);
    statusEl.textContent = t('vault.confirming');
    const receipt = await createTx.wait(); recordGasCost(receipt);

    // Extract on-chain vault ID
    let onChainVaultId;
    const createLog = receipt.logs.find(l => {
      try { return caveau.interface.parseLog(l)?.name === 'VaultCreated'; } catch { return false; }
    });
    if (createLog) {
      onChainVaultId = Number(caveau.interface.parseLog(createLog).args.vaultId);
    } else {
      const nextId = await caveau.nextVaultId();
      onChainVaultId = Number(nextId) - 1;
    }

    // Save locally
    const vault = {
      id: uid(), name, icon,
      color: state.selectedPreset.color,
      target, currency, unlockDate,
      unlockMode: mode,
      strategy,
      onChainContract: strategy,
      onChainVaultId,
      transactions: [],
      createdAt: new Date().toISOString()
    };
    state.vaults.push(vault);
    await saveVaults();

    statusEl.classList.add('hidden');
    closeModal('modal-new-vault');
    renderDashboard();
  } catch(e) {
    console.error('[createVault] Error on-chain:', e);
    showError('vault-error', '❌ ' + (e.reason || e.shortMessage || e.message || t('common.error')).slice(0, 150));
  } finally {
    if (createBtn) { createBtn.disabled = false; createBtn.innerHTML = '<img src="/logo-grande.webp" alt="" style="width:24px;height:24px;border-radius:50%"> ' + t('newvault.create_btn'); }
  }
};

App.openVaultDetail = function(id) {
  state.currentVaultId = id;
  const vault = state.vaults.find(v => v.id === id);
  if (!vault) return;
  try { renderVaultDetail(vault); } catch(e) { console.error('[renderVaultDetail] Error:', e); }
  openModal('modal-vault-detail');
};

function renderVaultDetail(vault) {
  const total = vaultTotal(vault);
  const pct = vault.target ? Math.min((total / vault.target) * 100, 100) : 0;
  const mode = vault.unlockMode ?? 0;
  const unlocked = isVaultUnlocked(vault);

  // Populate wallet address in direct transfer section
  const detailAddr = document.getElementById('detail-wallet-addr');
  if (detailAddr && state.address) detailAddr.textContent = state.address;

  // Hide rename form on re-render
  const renameForm = document.getElementById('vault-rename-form');
  if (renameForm) renameForm.classList.add('hidden');

  // Hero section
  const iconEl = document.getElementById('detail-icon');
  if (iconEl) iconEl.innerHTML = renderVaultIcon(vault.icon || '🐷', 56, true);
  document.getElementById('detail-title').textContent = vault.name || t('common.vault');
  document.getElementById('detail-amount').textContent = total.toFixed(2) + ' ' + (vault.currency || '');
  const curLabel = document.getElementById('detail-currency-label');
  if (curLabel) curLabel.textContent = vault.currency;

  // Progress bar — only show when vault has a target amount
  const progressSection = document.getElementById('detail-progress-section');
  if (progressSection) {
    if (vault.target) {
      progressSection.style.display = '';
      document.getElementById('detail-target').textContent = `${Number(vault.target).toFixed(2)} ${vault.currency}`;
      document.getElementById('detail-pct').textContent = `${pct.toFixed(1)}%`;
      const bar = document.getElementById('detail-progress-bar');
      bar.style.width = `${Math.max(pct, 2)}%`;
    } else {
      progressSection.style.display = 'none';
    }
  }

  const countdown = document.getElementById('detail-countdown');
  if (unlocked) {
    countdown.innerHTML = '<i class="f7-icons" style="font-size:20px;vertical-align:middle;margin-right:4px">lock_open_fill</i> ' + t('detail.open');
    countdown.style.color = '#4ade80';
  } else {
    countdown.style.color = '#f1f5f9';
    if (mode === 0) {
      const d = daysUntil(vault.unlockDate);
      if (d <= 0) {
        countdown.innerHTML = '<i class="f7-icons" style="font-size:20px;vertical-align:middle;margin-right:4px">lock_open_fill</i> ' + t('detail.open'); countdown.style.color = '#4ade80';
      } else if (d < 1) {
        const unlockD = parseDateInput(vault.unlockDate);
        const hoursLeft = Math.max(0, Math.ceil((unlockD - new Date()) / 3600000));
        countdown.textContent = hoursLeft > 0 ? t('detail.hours', {h: hoursLeft}) : t('detail.few_minutes');
      } else {
        const mo = Math.floor(d/30), dd = d%30;
        countdown.textContent = mo > 0 ? t('detail.months_days', {mo: mo, dd: dd}) : t('dash.days', {d: d});
      }
    } else if (mode === 1) {
      const remaining = Math.max(0, vault.target - total);
      countdown.textContent = t('detail.to_reach', {amount: remaining.toFixed(0), currency: vault.currency});
    } else {
      countdown.innerHTML = '<i class="f7-icons" style="font-size:20px;vertical-align:middle;margin-right:4px">lock_fill</i> ' + t('detail.locked');
    }
  }

  const condEl = document.getElementById('detail-conditions');
  let condHTML = '';
  const hasDate = mode === 0 || mode === 2 || mode === 3;
  const hasAmount = mode === 1 || mode === 2 || mode === 3;
  const dateMet = vault.unlockDate ? daysUntil(vault.unlockDate) <= 0 : false;
  const amountMet = vault.target ? total >= vault.target : false;
  const connector = mode === 2 ? t('detail.or') : (mode === 3 ? t('detail.and') : '');

  if (hasDate) {
    const icon = dateMet ? '<i class="f7-icons" style="font-size:14px;color:#4ade80">checkmark_circle_fill</i>' : '<i class="f7-icons" style="font-size:14px;color:#60a5fa">clock</i>';
    const d = daysUntil(vault.unlockDate);
    const txt = dateMet ? t('detail.date_reached', {date: fmtDate(vault.unlockDate)}) : t('detail.condition_date_pending', {date: fmtDate(vault.unlockDate), d: d});
    condHTML += `<div class="flex items-center gap-2 ${dateMet ? 'text-green-400' : 'text-slate-300'}">${icon} <span>${txt}</span></div>`;
  }
  if (connector) {
    condHTML += `<div class="text-center text-xs text-slate-500 font-semibold">${connector}</div>`;
  }
  if (hasAmount) {
    const icon = amountMet ? '<i class="f7-icons" style="font-size:14px;color:#4ade80">checkmark_circle_fill</i>' : '<i class="f7-icons" style="font-size:14px;color:#60a5fa">money_dollar_circle</i>';
    const txt = amountMet ? t('detail.target_reached', {current: total.toFixed(2), target: Number(vault.target).toFixed(2)}) : `${total.toFixed(2)} / ${Number(vault.target).toFixed(2)} ${vault.currency}`;
    condHTML += `<div class="flex items-center gap-2 ${amountMet ? 'text-green-400' : 'text-slate-300'}">${icon} <span>${txt}</span></div>`;
  }
  // Aave interest info
  const isAaveVault = vault.strategy === 'aave' || vault.onChainContract === 'aave';
  if (isAaveVault) {
    const interest = vault._aaveEarnedInterest || 0;
    const currentVal = vault._aaveCurrentValue || total;
    condHTML += `<div class="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <div class="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1"><i class="f7-icons" style="font-size:14px">arrow_up_right</i> ${t('detail.aave_title')}</div>
      <div class="text-xs text-slate-300">${t('detail.aave_current')}: <strong class="text-emerald-400">${currentVal.toFixed(4)} ${vault.currency}</strong></div>
      <div class="text-xs text-slate-300">${t('detail.aave_earned')}: <strong class="text-emerald-400">+${interest.toFixed(6)} ${vault.currency}</strong></div>
      <div class="text-[10px] text-slate-500 mt-1">${t('detail.aave_disclaimer')}</div>
    </div>`;
  }
  condEl.innerHTML = condHTML;

  const unlockDateEl = document.getElementById('detail-unlock-date');
  unlockDateEl.textContent = unlockModeLabel(mode);

  const panicDateEl = document.getElementById('panic-date');
  if (vault.unlockDate) {
    panicDateEl.textContent = t('detail.panic_date', {date: fmtDate(vault.unlockDate)});
  } else {
    panicDateEl.textContent = t('detail.panic_target', {target: vault.target, currency: vault.currency});
  }

  renderTxList(vault);
  renderVaultChart(vault);

  // ── Withdraw / Withdrawn state ──
  const withdrawSection = document.getElementById('vault-withdraw-section');
  const withdrawnNotice = document.getElementById('vault-withdrawn-notice');
  const depositSection = document.getElementById('deposit-section');
  const panicBtn = document.getElementById('panic-btn');
  const deleteBtn = document.getElementById('delete-vault-btn');

  if (withdrawSection) withdrawSection.classList.add('hidden');
  if (withdrawnNotice) withdrawnNotice.classList.add('hidden');
  if (panicBtn) panicBtn.classList.remove('hidden');
  if (deleteBtn) { deleteBtn.classList.add('hidden'); deleteBtn.style.display = ''; }
  if (depositSection) depositSection.classList.remove('hidden');

  if (vault.withdrawn) {
    // Already withdrawn — hide deposit, show notice, allow delete
    if (withdrawnNotice) withdrawnNotice.classList.remove('hidden');
    if (depositSection) depositSection.classList.add('hidden');
    if (panicBtn) panicBtn.classList.add('hidden');
    if (deleteBtn) { deleteBtn.classList.remove('hidden'); deleteBtn.style.display = 'block'; }
  } else if (unlocked) {
    // Unlocked but not yet withdrawn — show withdraw button, hide deposit
    if (withdrawSection) withdrawSection.classList.remove('hidden');
    if (depositSection) depositSection.classList.add('hidden');
    if (panicBtn) panicBtn.classList.add('hidden');
    // Delete only if no funds left (total === 0)
    if (total === 0 && deleteBtn) { deleteBtn.classList.remove('hidden'); deleteBtn.style.display = 'block'; }
  } else {
    // Still locked — show deposit, show panic, delete ONLY if vault is empty (no deposits ever made)
    if (total === 0 && vault.transactions.length === 0) {
      if (deleteBtn) { deleteBtn.classList.remove('hidden'); deleteBtn.style.display = 'block'; }
    }
  }

  // ── Setup deposit (auto-detect payment method) ──
  state._payMethod = 'direct';
  state._crossChainCoin = null;
  const srcSelect = document.getElementById('deposit-src-token');
  if (srcSelect) srcSelect.value = 'native';
  document.getElementById('swap-quote-box')?.classList.add('hidden');
  document.getElementById('pay-auto-info')?.classList.add('hidden');
  const lockBtn = document.getElementById('deposit-lock-btn');
  lockBtn.textContent = t('deposit.lock_btn');
  const currSuffix = document.getElementById('deposit-currency-suffix');
  if (currSuffix) currSuffix.textContent = vault.currency;

  // Block deposits for unsupported currencies (e.g. EURC — not on Polygon)
  const depositErr = document.getElementById('deposit-error');
  if (!TOKEN_ADDRESSES[vault.currency]) {
    lockBtn.disabled = true;
    lockBtn.classList.add('opacity-40');
    if (depositErr) { depositErr.classList.remove('hidden'); depositErr.textContent = t('deposit.unsupported_currency', {currency: vault.currency}); }
  } else {
    lockBtn.disabled = false;
    lockBtn.classList.remove('opacity-40');
    if (depositErr) { depositErr.classList.add('hidden'); depositErr.textContent = ''; }
  }

  // Check MATIC balance for gas warning
  if (state.address) checkAndShowMaticWarning();
}

function renderTxList(vault) {
  const el = document.getElementById('detail-transactions');
  if (!vault.transactions.length) {
    el.innerHTML = `<p class="text-slate-500 text-sm text-center py-3">${t('detail.no_tx')}</p>`;
    return;
  }
  el.innerHTML = [...vault.transactions].reverse().map(tx => {
    const hash = tx.txHash || '';
    const hashShort = hash ? hash.slice(0,10) + '\u2026' + hash.slice(-6) : '—';
    const isPolygonTx = hash.startsWith('0x') && hash.length === 66;
    const badge = isPolygonTx
      ? `<a href="https://polygonscan.com/tx/${hash}" target="_blank" rel="noopener" class="text-xs font-mono text-blue-400 hover:text-blue-300 underline mt-0.5 block">${hashShort} ↗</a>`
      : (hash ? `<p class="text-xs text-slate-600 font-mono mt-0.5">${hashShort} <span class="text-slate-700">(${tx.crossChain ? 'cross-chain' : 'locale'})</span></p>` : '');
    const icon = tx.crossChain ? '\uD83C\uDF10' : (tx.onChain ? '\uD83D\uDD12' : '\uD83D\uDCDD');
    const swapNote = tx.swappedFrom ? `<span class="text-xs text-purple-400 ml-1">(da ${tx.swappedFrom})</span>` : '';
    const ccNote = tx.crossChain ? `<span class="text-xs text-purple-400 ml-1">(cross-chain)</span>` : '';
    const dateStr = tx.date ? fmtDateShort(tx.date.split('T')[0]) : '—';
    return `
    <div class="bg-slate-800 rounded-xl px-4 py-3 flex justify-between items-center">
      <div>
        <p class="text-sm font-semibold">${icon} +${tx.amount} ${vault.currency}${swapNote}${ccNote}</p>
        ${badge}
      </div>
      <span class="text-xs text-slate-400">${dateStr}</span>
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

// ─── Withdraw Vault ──────────────────────────────────────────
App.withdrawVault = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const btn = document.getElementById('withdraw-btn');
  const status = document.getElementById('withdraw-status');
  btn.disabled = true;
  btn.textContent = t('withdraw.in_progress');
  if (status) { status.textContent = ''; status.className = 'text-xs mt-2 text-center'; }

  try {
    if (!state.walletSigner) throw new Error(t('vault.error_wallet'));
    const isAave = vault.strategy === 'aave' || vault.onChainContract === 'aave';
    const contractAddr = isAave ? CAVEAU_AAVE_CONTRACT : CAVEAU_CONTRACT;
    const abi = isAave ? CAVEAU_AAVE_ABI : CAVEAU_ABI;
    const contract = new ethers.Contract(contractAddr, abi, state.walletSigner);

    // Pre-flight: check if contract considers vault unlocked
    if (status) { status.textContent = t('withdraw.checking'); status.className = 'text-xs mt-2 text-center text-slate-400'; }
    try {
      const onChainUnlocked = await contract.isUnlocked(vault.onChainVaultId);
      if (!onChainUnlocked) {
        // Read on-chain data for debug info
        const v = await contract.getVault(vault.onChainVaultId);
        const onChainTs = Number(v.unlockDate);
        const provider = state.walletSigner.provider;
        const block = await provider.getBlock('latest');
        const blockTs = block.timestamp;
        const diff = onChainTs - Number(blockTs);
        const unlockLocal = onChainTs > 0 ? new Date(onChainTs * 1000).toLocaleString() : t('common.no_date');
        throw new Error(t('withdraw.not_unlocked_debug', {unlockLocal, blockTime: new Date(Number(blockTs) * 1000).toLocaleString(), minutes: Math.ceil(diff/60)}));
      }
    } catch(preErr) {
      if (preErr.message.includes('not_unlocked')) throw preErr;
      console.warn('[withdrawVault] Pre-flight check failed, attempting withdraw anyway:', preErr.message);
    }

    const tx = await contract.withdraw(vault.onChainVaultId);
    if (status) { status.textContent = t('withdraw.tx_sent'); status.className = 'text-xs mt-2 text-center text-yellow-400'; }
    const rcptW = await tx.wait(); recordGasCost(rcptW);

    vault.withdrawn = true;
    await saveVaults();
    await refreshWalletBalance(false);
    renderVaultDetail(vault);
    renderDashboard();
    openModal('modal-vault-detail');
    if (status) { status.textContent = t('withdraw.success'); status.className = 'text-xs mt-2 text-center text-green-400'; }
  } catch(err) {
    console.error('[withdrawVault]', err);
    btn.disabled = false;
    btn.textContent = t('withdraw.btn');
    // Translate known errors
    let msg = err.reason || err.shortMessage || err.message || t('common.error');
    if (msg.includes('VaultNotUnlocked')) msg = t('withdraw.err_not_unlocked');
    else if (msg.includes('AlreadyWithdrawn')) msg = t('withdraw.err_already');
    else if (msg.includes('NotVaultOwner')) msg = t('withdraw.err_not_owner');
    else if (msg.includes('NoFundsToWithdraw')) msg = t('withdraw.err_no_funds');
    if (status) { status.textContent = '❌ ' + msg.slice(0, 200); status.className = 'text-xs mt-2 text-center text-red-400'; }
  }
};

// ─── Delete Vault ────────────────────────────────────────────
function getDeletedVaultKeys() {
  try { return JSON.parse(localStorage.getItem(STORAGE.DELETED_VAULTS) || '[]'); } catch { return []; }
}
function addDeletedVaultKey(onChainVaultId, strategy) {
  const list = getDeletedVaultKeys();
  const key = `${strategy}:${onChainVaultId}`;
  if (!list.includes(key)) { list.push(key); localStorage.setItem(STORAGE.DELETED_VAULTS, JSON.stringify(list)); }
}
function isVaultDeleted(onChainVaultId, strategy) {
  return getDeletedVaultKeys().includes(`${strategy}:${onChainVaultId}`);
}

// ─── Gas Cost Tracking ──────────────────────────────────────
function getGasLog() {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE.GAS_LOG) || '[]');
    const addr = (state.address || '').toLowerCase();
    if (!addr) return [];
    return all.filter(r => (r.addr || '').toLowerCase() === addr || !r.addr);
  } catch { return []; }
}
async function recordGasCost(receipt) {
  if (!receipt) return;
  try {
    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice = receipt.gasPrice || receipt.effectiveGasPrice;
    if (!gasUsed || !effectiveGasPrice) return;
    const costWei = gasUsed * effectiveGasPrice;
    const costPOL = Number(ethers.formatEther(costWei));
    let log; try { log = JSON.parse(localStorage.getItem(STORAGE.GAS_LOG) || '[]'); } catch { log = []; }
    log.push({ txHash: receipt.hash, pol: costPOL, ts: Date.now(), addr: (state.address || '').toLowerCase() });
    localStorage.setItem(STORAGE.GAS_LOG, JSON.stringify(log));
  } catch(e) { console.warn('[GasTrack] Failed to record:', e); }
}
let _gasHistoryFetched = false;
async function fetchGasHistory() {
  if (!state.address || _gasHistoryFetched) return;
  _gasHistoryFetched = true;
  try {
    const resp = await fetch('https://polygon.blockscout.com/api?module=account&action=txlist&address=' + state.address + '&startblock=0&endblock=99999999&sort=desc&page=1&offset=200');
    const data = await resp.json();
    if (data.status !== '1' || !Array.isArray(data.result)) { console.warn('[GasTrack] Blockscout API error:', data.message, data.result); return; }
    const addr = state.address.toLowerCase();
    const entries = data.result
      .filter(function(tx){ return tx.from.toLowerCase() === addr; })
      .map(function(tx){
        const costWei = BigInt(tx.gasUsed) * BigInt(tx.gasPrice);
        return { txHash: tx.hash, pol: Number(ethers.formatEther(costWei)), ts: Number(tx.timeStamp) * 1000, addr: addr };
      });
    if (entries.length > 0) {
      let existing; try { existing = JSON.parse(localStorage.getItem(STORAGE.GAS_LOG) || '[]'); } catch(e2) { existing = []; }
      const hashes = new Set(existing.map(function(e){ return e.txHash; }));
      const newEntries = entries.filter(function(e){ return !hashes.has(e.txHash); });
      if (newEntries.length > 0) {
        localStorage.setItem(STORAGE.GAS_LOG, JSON.stringify(existing.concat(newEntries)));
      }
    }
  } catch(e) { console.warn('[GasTrack] Failed to fetch history from Blockscout:', e); }
}
function getTotalGasSpent() {
  return getGasLog().reduce((s, r) => s + (r.pol || 0), 0);
}
let _polPriceUsd = 0;
let _eurUsdRate = 0; // 1 USD = ? EUR
let _ratesLastFetch = 0; // timestamp of last successful fetch
const RATES_CACHE_MS = 60 * 60 * 1000; // 1 hour cache

async function fetchFiatRates() {
  // Primary: ExchangeRate-API (ECB data, 99.99% uptime)
  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await resp.json();
    if (data.rates?.EUR) { _eurUsdRate = data.rates.EUR; return; }
  } catch(e) { console.warn('[Rates] ExchangeRate-API failed:', e); }
  // Fallback: fawazahmed0/exchange-api (CDN + Cloudflare)
  try {
    const resp = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json');
    const data = await resp.json();
    if (data.usd?.eur) { _eurUsdRate = data.usd.eur; return; }
  } catch(e) { console.warn('[Rates] fawazahmed0 fallback failed:', e); }
}

async function fetchPolPrice() {
  // Primary: CoinGecko
  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd');
    const data = await resp.json();
    if (data['matic-network']?.usd) { _polPriceUsd = data['matic-network'].usd; return _polPriceUsd; }
  } catch(e) { console.warn('[Rates] CoinGecko POL failed:', e); }
  // Fallback 1: CryptoCompare
  try {
    const resp = await fetch('https://min-api.cryptocompare.com/data/price?fsym=POL&tsyms=USD');
    const data = await resp.json();
    if (data.USD) { _polPriceUsd = data.USD; return _polPriceUsd; }
  } catch(e) { console.warn('[Rates] CryptoCompare POL failed:', e); }
  // Fallback 2: Binance
  try {
    const resp = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=POLUSDT');
    const data = await resp.json();
    if (data.price) { _polPriceUsd = parseFloat(data.price); return _polPriceUsd; }
  } catch(e) { console.warn('[Rates] Binance POL failed:', e); }
  return _polPriceUsd;
}

async function fetchAllRates() {
  if (_ratesLastFetch && (Date.now() - _ratesLastFetch < RATES_CACHE_MS) && _eurUsdRate > 0 && _polPriceUsd > 0) return;
  await Promise.all([fetchFiatRates(), fetchPolPrice()]);
  _ratesLastFetch = Date.now();
  console.log('[Rates] EUR/USD:', _eurUsdRate, 'POL/USD:', _polPriceUsd);
}

function getDisplayCurrency() {
  return localStorage.getItem(STORAGE.DISPLAY_CURRENCY) || 'USD';
}
function currencySymbol(cur) {
  return cur === 'EUR' ? '€' : cur === 'POL' ? '◈' : '$';
}
function stablecoinToFiat(coin) {
  const map = { USDC: 'USD', USDT: 'USD', DAI: 'USD', EURe: 'EUR', ZCHF: 'CHF' };
  return map[coin] || coin;
}
function convertFromUsd(usdAmount, cur) {
  if (!cur) cur = getDisplayCurrency();
  if (cur === 'EUR') return _eurUsdRate > 0 ? usdAmount * _eurUsdRate : usdAmount;
  if (cur === 'POL') return _polPriceUsd > 0 ? usdAmount / _polPriceUsd : 0;
  return usdAmount;
}
function fmtDisplayAmount(usdAmount, decimals) {
  const cur = getDisplayCurrency();
  const val = convertFromUsd(usdAmount, cur);
  if (decimals === undefined) decimals = cur === 'POL' ? 2 : 2;
  return val.toFixed(decimals);
}

App.setDisplayCurrency = async function(cur) {
  localStorage.setItem(STORAGE.DISPLAY_CURRENCY, cur);
  // Update selector UI
  const btns = document.querySelectorAll('#currency-selector button');
  btns.forEach(b => {
    if (b.dataset.cur === cur) { b.className = 'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors bg-blue-600 text-white'; }
    else { b.className = 'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600'; }
  });
  // Fetch rates before refreshing displays
  await fetchAllRates();
  refreshWalletBalance(true);
  renderDashboard();
  updateDonateSymbols();
};

App.deleteVault = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const total = vaultTotal(vault);
  // Only allow delete if vault has zero funds (empty, or already withdrawn)
  if (total > 0) return;
  if (!confirm(`Vuoi davvero eliminare "${vault.icon} ${vault.name}"?`)) return;

  // Mark as deleted on-chain (so it persists across devices)
  if (vault.onChainVaultId != null && state.walletSigner) {
    try {
      const isAave = vault.strategy === 'aave' || vault.onChainContract === 'aave';
      const contractAddr = isAave ? CAVEAU_AAVE_CONTRACT : CAVEAU_CONTRACT;
      const abi = isAave ? CAVEAU_AAVE_ABI : CAVEAU_ABI;
      const contract = new ethers.Contract(contractAddr, abi, state.walletSigner);
      const tx = await contract.updateVaultMetadata(vault.onChainVaultId, '__DELETED__', '');
      const rcptD = await tx.wait(); recordGasCost(rcptD);
    } catch(e) {
      console.warn('[deleteVault] On-chain delete flag failed (using localStorage fallback):', e);
    }
  }
  // Also persist locally as fallback
  if (vault.onChainVaultId != null) {
    addDeletedVaultKey(vault.onChainVaultId, vault.strategy || vault.onChainContract || 'base');
  }
  state.vaults = state.vaults.filter(v => v.id !== vault.id);
  await saveVaults();
  App.closeModal('modal-vault-detail');
  renderDashboard();
};

// ─── Rename Vault ────────────────────────────────────────────
App.startRenameVault = function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const form = document.getElementById('vault-rename-form');
  const input = document.getElementById('vault-rename-input');
  const status = document.getElementById('vault-rename-status');
  form.classList.remove('hidden');
  input.value = vault.name;
  input.focus();
  status.classList.add('hidden');
};

App.cancelRenameVault = function() {
  document.getElementById('vault-rename-form').classList.add('hidden');
};

App.confirmRenameVault = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const input = document.getElementById('vault-rename-input');
  const newName = input.value.trim();
  if (!newName) return;
  if (newName === vault.name) { App.cancelRenameVault(); return; }

  const btn = document.getElementById('vault-rename-btn');
  const status = document.getElementById('vault-rename-status');

  // If vault is on-chain, update metadata on blockchain
  if (vault.onChainVaultId !== undefined && vault.onChainVaultId !== null && state.walletSigner) {
    // Gas check
    const maticBal = await getMaticBalance();
    if (maticBal !== null && maticBal < 0.001) {
      status.textContent = t('rename.need_matic', {bal: maticBal.toFixed(4)});
      status.className = 'text-xs mt-2 text-red-400';
      status.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = t('rename.saving');
    status.textContent = t('vault.creating');
    status.className = 'text-xs mt-2 text-yellow-400';
    status.classList.remove('hidden');

    try {
      const isAave = vault.strategy === 'aave' || vault.onChainContract === 'aave';
      const contractAddr = isAave ? CAVEAU_AAVE_CONTRACT : CAVEAU_CONTRACT;
      const contractAbi  = isAave ? CAVEAU_AAVE_ABI : CAVEAU_ABI;
      const caveau = new ethers.Contract(contractAddr, contractAbi, state.walletSigner);
      const tx = await caveau.updateVaultMetadata(vault.onChainVaultId, newName, vault.icon);
      status.textContent = t('vault.confirming');
      const rcptR = await tx.wait(); recordGasCost(rcptR);

      vault.name = newName;
      await saveVaults();

      status.textContent = t('rename.success');
      status.className = 'text-xs mt-2 text-green-400';
      document.getElementById('detail-title').textContent = vault.icon + ' ' + vault.name;
      renderDashboard();

      setTimeout(() => App.cancelRenameVault(), 1500);
    } catch(e) {
      console.error('[Rename] Error:', e);
      status.textContent = '❌ ' + (e.reason || e.shortMessage || e.message || t('common.error')).slice(0, 100);
      status.className = 'text-xs mt-2 text-red-400';
    } finally {
      btn.disabled = false;
      btn.textContent = t('rename.save_btn');
    }
  } else {
    // Vault only local — just update localStorage
    vault.name = newName;
    await saveVaults();
    document.getElementById('detail-title').textContent = vault.icon + ' ' + vault.name;
    renderDashboard();
    App.cancelRenameVault();
  }
};

// ─── Charts (lazy-loaded) ─────────────────────────────────────
let _chartLoaded = typeof Chart !== 'undefined';
let _chartPromise = null;
function loadChartJS() {
  if (_chartLoaded) return Promise.resolve();
  if (_chartPromise) return _chartPromise;
  _chartPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/lib/chart.umd.min.js';
    s.onload = () => { _chartLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Chart.js load failed'));
    document.head.appendChild(s);
  });
  return _chartPromise;
}

const CHART_DEFAULTS = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: '#64748b', maxTicksLimit: 7 }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }
  }
};

async function renderDashChart() {
  await loadChartJS();
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

async function renderVaultChart(vault) {
  await loadChartJS();
  const ctx = document.getElementById('vault-chart').getContext('2d');
  if (state.vaultChart) state.vaultChart.destroy();
  const { labels, actual, ideal } = buildVaultChartData(vault);
  const datasets = [];
  // Only show ideal line when vault has a target amount
  if (vault.target && ideal.length > 0) {
    datasets.push({ label: 'Obiettivo lineare', data: ideal, borderColor: 'rgba(251,191,36,.7)', borderDash: [6,4], borderWidth: 2, pointRadius: 0, fill: false });
  }
  datasets.push({ label: 'Risparmio reale', data: actual, borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,.15)', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#34d399', fill: true, tension: 0.3 });
  state.vaultChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { display: datasets.length > 1, labels: { color: '#94a3b8', boxWidth: 14, font: { size: 11 } } }
      },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 7 }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } }
      }
    }
  });
}

function buildVaultChartData(vault) {
  const start = new Date(vault.createdAt);
  const end   = vault.unlockDate ? (parseDateInput(vault.unlockDate) || new Date(start.getTime() + 365*86400000)) : new Date(start.getTime() + 365*86400000);
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
    const m = (t.date || '').slice(0,7);
    if (m) txByMonth[m] = (txByMonth[m]||0) + t.amount;
  });
  let running = 0;
  const actual = months.map(m => { running += txByMonth[m]||0; return +running.toFixed(2); });

  return { labels: months, actual, ideal };
}

// ─── Settings ────────────────────────────────────────────────
function updateBiometricUI() {
  const status = document.getElementById('biometric-status');
  const enableBtn = document.getElementById('biometric-enable-btn');
  const disableBtn = document.getElementById('biometric-disable-btn');
  const unlockBtn = document.getElementById('unlock-biometric-btn');

  const supported = hasBiometricCapability();
  const configured = isBioConfigured();

  if (status) {
    let key = 'bio.not_active';
    if (!supported) key = 'bio.not_supported';
    else if (configured) key = 'bio.active';
    status.textContent = t(key);
    status.dataset.i18n = key;
  }
  if (enableBtn) enableBtn.classList.toggle('hidden', !supported || configured);
  if (disableBtn) disableBtn.classList.toggle('hidden', !configured);
  if (unlockBtn) unlockBtn.classList.toggle('hidden', !supported || !configured);

  // Update prominent biometric card in settings
  const bioCard = document.getElementById('bio-card-settings');
  const bioCardIcon = document.getElementById('bio-card-icon');
  const bioCardTitle = document.getElementById('bio-card-title');
  const bioCardDesc = document.getElementById('bio-card-desc');
  const bioCardBtn = document.getElementById('bio-card-btn');
  if (bioCard) {
    if (!supported) {
      bioCard.style.display = 'none';
    } else {
      bioCard.style.display = '';
      if (configured) {
        bioCard.style.background = 'linear-gradient(135deg,rgba(16,185,129,.12),rgba(30,41,59,.5))';
        bioCard.style.border = '1px solid rgba(16,185,129,.3)';
        if (bioCardIcon) bioCardIcon.style.color = '#4ade80';
        if (bioCardTitle) { bioCardTitle.textContent = t('bio.card_active_title'); bioCardTitle.style.color = '#4ade80'; }
        if (bioCardDesc) { bioCardDesc.textContent = t('bio.card_active_desc'); bioCardDesc.style.color = '#6ee7b7'; }
        if (bioCardBtn) { bioCardBtn.textContent = t('bio.card_disable'); bioCardBtn.style.background = 'rgba(239,68,68,.1)'; bioCardBtn.style.color = '#fca5a5'; bioCardBtn.style.border = '1px solid rgba(239,68,68,.25)'; }
      } else {
        bioCard.style.background = 'linear-gradient(135deg,rgba(16,185,129,.06),rgba(30,41,59,.5))';
        bioCard.style.border = '1px solid rgba(16,185,129,.2)';
        if (bioCardIcon) bioCardIcon.style.color = '#10b981';
        if (bioCardTitle) { bioCardTitle.textContent = t('bio.card_title'); bioCardTitle.style.color = '#6ee7b7'; }
        if (bioCardDesc) { bioCardDesc.textContent = t('bio.card_desc'); bioCardDesc.style.color = '#94a3b8'; }
        if (bioCardBtn) { bioCardBtn.textContent = t('bio.card_btn'); bioCardBtn.style.background = 'rgba(16,185,129,.15)'; bioCardBtn.style.color = '#6ee7b7'; bioCardBtn.style.border = '1px solid rgba(16,185,129,.3)'; }
      }
    }
  }
}

App.toggleBiometricFromCard = function() {
  if (isBioConfigured()) {
    App.disableBiometricUnlock();
  } else {
    if (isTwUser()) {
      App.enableBiometricTw();
    } else {
      App.enableBiometricUnlock();
    }
  }
};

App.enableBiometricUnlock = async function(fromPrompt = false) {
  if (!hasBiometricCapability()) {
    alert(t('bio.not_supported'));
    return;
  }
  if (!state.address || !state.lastUnlockPin) {
    alert(t('bio.unlock_first'));
    return;
  }

  try {
    const userId = new TextEncoder().encode(state.address.toLowerCase());
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'PiggyVault' },
        user: {
          id: userId,
          name: state.address,
          displayName: 'PiggyVault User'
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        attestation: 'none'
      }
    });

    if (!credential) throw new Error('setup-cancelled');

    const bioWrapKey = await deriveKeyFromString(state.address.toLowerCase(), 'caveau-bio-wrap-v1');
    const pinEnc = await encrypt(bioWrapKey, state.lastUnlockPin);
    localStorage.setItem(STORAGE.BIO_CRED_ID, bytesToBase64(new Uint8Array(credential.rawId)));
    localStorage.setItem(STORAGE.BIO_PIN_ENC, pinEnc);
    localStorage.setItem(STORAGE.BIO_PROMPT_SEEN, '1');
    updateBiometricUI();
    if (fromPrompt) App.closeModal('modal-biometric-optin');
    alert(t('bio.enabled'));
  } catch (err) {
    if ((err?.name || '').toLowerCase() === 'notallowederror') return;
    alert(t('bio.failed'));
  }
};

App.enableBiometricTw = async function(fromPrompt = false) {
  if (!hasBiometricCapability()) {
    alert(t('bio.not_supported'));
    return;
  }
  if (!state.address) return;

  try {
    const userId = new TextEncoder().encode(state.address.toLowerCase());
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'PiggyVault' },
        user: {
          id: userId,
          name: state.address,
          displayName: 'PiggyVault User'
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        attestation: 'none'
      }
    });

    if (!credential) throw new Error('setup-cancelled');

    localStorage.setItem(STORAGE.BIO_CRED_ID, bytesToBase64(new Uint8Array(credential.rawId)));
    localStorage.setItem(STORAGE.BIO_TW_ENABLED, '1');
    localStorage.setItem(STORAGE.BIO_PROMPT_SEEN, '1');
    updateBiometricUI();
    if (fromPrompt) App.closeModal('modal-biometric-optin');
    alert(t('bio.enabled'));
  } catch (err) {
    if ((err?.name || '').toLowerCase() === 'notallowederror') return;
    alert(t('bio.failed'));
  }
};

App.enableBiometricFromPrompt = function() {
  if (isTwUser()) {
    App.enableBiometricTw(true);
  } else {
    App.enableBiometricUnlock(true);
  }
};

App.dismissBiometricPrompt = function() {
  localStorage.setItem(STORAGE.BIO_PROMPT_SEEN, '1');
  App.closeModal('modal-biometric-optin');
};

App.disableBiometricUnlock = function() {
  const msg = t('bio.confirm_disable') !== 'bio.confirm_disable'
    ? t('bio.confirm_disable')
    : 'Sei sicuro di voler disattivare la biometria?\n\nSenza biometria il tuo account sarà meno protetto.';
  if (!confirm(msg)) return;
  localStorage.removeItem(STORAGE.BIO_CRED_ID);
  localStorage.removeItem(STORAGE.BIO_PIN_ENC);
  localStorage.removeItem(STORAGE.BIO_TW_ENABLED);
  updateBiometricUI();
};

App.unlockWithBiometric = async function() {
  if (!hasBiometricCapability()) return;
  const credId = localStorage.getItem(STORAGE.BIO_CRED_ID);
  const pinEnc = localStorage.getItem(STORAGE.BIO_PIN_ENC);
  const savedAddress = localStorage.getItem(STORAGE.ADDRESS);
  if (!credId || !pinEnc || !savedAddress) return;

  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{ type: 'public-key', id: base64ToBytes(credId) }],
        userVerification: 'required',
        timeout: 60000
      }
    });

    const bioWrapKey = await deriveKeyFromString(savedAddress.toLowerCase(), 'caveau-bio-wrap-v1');
    const pin = await decrypt(bioWrapKey, pinEnc);
    state.pinBuffer.unlock = String(pin || '').slice(0, 6);
    syncNativePinInput('unlock', state.pinBuffer.unlock);
    updatePinDots('unlock', state.pinBuffer.unlock.length);
    if (state.pinBuffer.unlock.length === 6) await handleUnlock();
  } catch {
    showError('pin-error-unlock', 'Autenticazione biometrica annullata o fallita.');
  }
};

// ─── Tab Navigation ──────────────────────────────────────────
App.switchTab = function(tabId) {
  // Use F7 native tab switching if available
  if (f7app) {
    f7app.tab.show('#' + tabId, true);
  } else {
    // Fallback: manual class toggle
    document.querySelectorAll('.tabs.app-tabs > .tab').forEach(t => t.classList.remove('tab-active'));
    document.querySelectorAll('.toolbar.tabbar .tab-link').forEach(a => a.classList.remove('tab-link-active'));
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('tab-active');
    const link = document.querySelector(`.toolbar.tabbar .tab-link[href="#${tabId}"]`);
    if (link) link.classList.add('tab-link-active');
  }
  // Run tab-specific init
  if (tabId === 'tab-settings') App._initSettingsTab();
  if (tabId === 'tab-stats') {
    renderExtraStats();
    const cs = document.getElementById('chart-section');
    if (cs && state.vaults && state.vaults.length > 0) { cs.classList.remove('hidden'); renderDashChart(); }
    else if (cs) { cs.classList.add('hidden'); }
  }
};

App._initSettingsTab = function() {
  updateBiometricUI();
  _loadBankDetailsUI();
  const twInfo = document.getElementById('settings-tw-info');
  const seedBtn = document.getElementById('settings-seed-btn');
  const exportKeyBtn = document.getElementById('settings-export-key-btn');
  const bioSection = document.getElementById('biometric-enable-btn')?.closest('div[style*="border-radius:16px"]');
  if (state.isTwAuth) {
    if (twInfo) { twInfo.classList.remove('hidden'); }
    const emailEl = document.getElementById('settings-tw-email');
    if (emailEl) emailEl.textContent = state.twEmail || localStorage.getItem(STORAGE.TW_EMAIL) || '—';
    if (seedBtn) seedBtn.classList.add('hidden');
    if (exportKeyBtn) exportKeyBtn.classList.remove('hidden');
    if (bioSection) bioSection.classList.add('hidden');
  } else {
    if (twInfo) twInfo.classList.add('hidden');
    if (seedBtn) seedBtn.classList.remove('hidden');
    if (exportKeyBtn) exportKeyBtn.classList.add('hidden');
    if (bioSection) bioSection.classList.remove('hidden');
  }
  updatePasskeyUI();
  const activeCur = getDisplayCurrency();
  const curBtns = document.querySelectorAll('#currency-selector button');
  curBtns.forEach(b => {
    if (b.dataset.cur === activeCur) { b.className = 'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors bg-blue-600 text-white'; }
    else { b.className = 'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600'; }
  });
  /* ── Language selector ── */
  const langBox = document.getElementById('lang-selector');
  if (langBox && window.LANG_META) {
    const cur = getAppLanguage();
    const langs = getSupportedLanguages();
    if (!langBox.options.length) {
      langs.forEach(code => {
        const meta = LANG_META[code];
        if (!meta) return;
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = meta.flag + '  ' + meta.name;
        langBox.appendChild(opt);
      });
    }
    langBox.value = cur;
  }
};

App.showSettings = function() {
  App.switchTab('tab-settings');
};

App.showSeedPhrase = function() {
  const blob = localStorage.getItem(STORAGE.SEED_ENC);
  if (!blob) { alert(t('seed.not_found')); return; }
  state.pinVerifyBuffer = '';
  syncNativePinInput('verify', '');
  updatePinDotsVerify(0);
  document.getElementById('pin-verify-error').classList.add('hidden');
  state.pinVerifyCallback = async (pin) => {
    const salt = localStorage.getItem(STORAGE.PIN_SALT);
    try {
      const pinKey = await deriveKeyFromString(pin, 'caveau-pin-' + salt);
      const mnemonic = await decrypt(pinKey, blob);
      renderSeedWordGrid(mnemonic, 'show-seed-grid');
      App.closeModal('modal-pin-verify');
      App.openModal('modal-show-seed');
    } catch {
      state.pinVerifyBuffer = '';
      syncNativePinInput('verify', '');
      updatePinDotsVerify(0);
      showError('pin-verify-error', t('pin.wrong'));
    }
  };
  App.openModal('modal-pin-verify');
  setTimeout(() => document.getElementById('pin-native-verify')?.focus(), 120);
};

App.copySeedPhrase = function() {
  const words = [...document.querySelectorAll('#show-seed-grid .sw-text')].map(e => e.textContent).join(' ');
  navigator.clipboard.writeText(words).then(() => alert(t('seed.copied_alert')));
};

// ─── Export Private Key (Thirdweb) ───────────────────────────
let _exportedKey = '';

App.exportPrivateKey = async function() {
  if (!state.isTwAuth) return;
  // Reset modal state
  document.getElementById('export-key-loading').classList.remove('hidden');
  document.getElementById('export-key-found').classList.add('hidden');
  document.getElementById('export-key-info').classList.add('hidden');
  document.getElementById('export-key-value').textContent = '';
  document.getElementById('export-key-value').style.filter = 'blur(4px)';
  _exportedKey = '';
  openModal('modal-export-key');

  // Try to extract private key from ethers signer
  let pk = null;
  try {
    if (state.walletSigner) {
      // ethers v6 Wallet exposes signingKey.privateKey
      pk = state.walletSigner.privateKey
        || state.walletSigner.signingKey?.privateKey
        || null;
    }
  } catch(e) {
    console.log('[Export] Signer privateKey not accessible:', e.message);
  }

  document.getElementById('export-key-loading').classList.add('hidden');

  if (pk && typeof pk === 'string' && pk.startsWith('0x')) {
    // Key accessible — show it
    _exportedKey = pk;
    document.getElementById('export-key-value').textContent = pk;
    document.getElementById('export-key-found').classList.remove('hidden');
  } else {
    // Key not accessible (Thirdweb enclave) — show portability info
    document.getElementById('export-key-address').textContent = state.address || '—';
    document.getElementById('export-key-info').classList.remove('hidden');
  }
};

App.closeExportKeyModal = function() {
  _exportedKey = '';
  document.getElementById('export-key-value').textContent = '';
  App.closeModal('modal-export-key');
};

App.copyExportedKey = function() {
  if (!_exportedKey) return;
  navigator.clipboard.writeText(_exportedKey).then(() => {
    const toast = app.toast.create({ text: t('export.copied_toast'), position: 'top', closeTimeout: 2000 });
    toast.open();
  });
};

App.copyExportAddress = function() {
  const addr = state.address || '';
  if (!addr) return;
  navigator.clipboard.writeText(addr).then(() => {
    const toast = app.toast.create({ text: t('export.address_copied_toast'), position: 'top', closeTimeout: 2000 });
    toast.open();
  });
};

// ─── Donation System ─────────────────────────────────────────
let _donateAmount = 0;

App.selectDonation = function(amt) {
  const btns = document.querySelectorAll('#donate-amounts .donate-btn');
  btns.forEach(b => b.classList.remove('selected'));
  const customRow = document.getElementById('donate-custom-row');
  const sendBtn = document.getElementById('donate-send-btn');

  if (amt === 'custom') {
    customRow.classList.remove('hidden');
    btns[btns.length - 1].classList.add('selected');
    _donateAmount = 0;
    sendBtn.classList.remove('hidden');
    document.getElementById('donate-custom-input').focus();
    return;
  }
  customRow.classList.add('hidden');
  btns.forEach(b => { if (b.dataset.amt === String(amt)) b.classList.add('selected'); });
  _donateAmount = amt;
  sendBtn.classList.remove('hidden');
};

App.confirmDonation = function() {
  let amount = _donateAmount;
  if (amount === 0) {
    const custom = parseFloat(document.getElementById('donate-custom-input').value);
    if (!custom || custom <= 0) { f7app.dialog.alert(t('donate.error_amount')); return; }
    amount = custom;
  }
  if (!state.walletSigner) { f7app.dialog.alert(t('donate.error_login')); return; }

  const cur = getDisplayCurrency();
  const sym = currencySymbol(cur);
  const tokenSym = cur === 'EUR' ? 'EURe' : cur === 'POL' ? 'POL' : 'USDC';

  f7app.dialog.confirm(
    t('donate.confirm_body', {sym, amount, tokenSym}),
    t('donate.confirm_title'),
    function() { App.executeDonation(amount, cur); }
  );
};

App.executeDonation = async function(amount, cur) {
  const statusEl = document.getElementById('donate-status');
  const sendBtn = document.getElementById('donate-send-btn');
  statusEl.classList.remove('hidden');
  statusEl.className = 'text-xs mt-2 text-center text-blue-400';
  statusEl.textContent = t('donate.sending');
  sendBtn.disabled = true;

  try {
    let tx;
    if (cur === 'POL') {
      const weiAmount = ethers.parseEther(amount.toString());
      tx = await state.walletSigner.sendTransaction({
        to: DONATION_ADDRESS,
        value: weiAmount,
      });
    } else {
      const tokenSym = cur === 'EUR' ? 'EURe' : 'USDC';
      const tokenAddr = TOKEN_ADDRESSES[tokenSym];
      const decimals = TOKEN_DECIMALS[tokenSym];
      if (!tokenAddr) { throw new Error(t('donate.token_unavailable', {token: tokenSym})); }
      const token = new ethers.Contract(tokenAddr, ERC20_ABI, state.walletSigner);
      const units = ethers.parseUnits(amount.toString(), decimals);
      tx = await token.transfer(DONATION_ADDRESS, units);
    }
    statusEl.textContent = t('vault.confirming');
    const receipt = await tx.wait();
    recordGasCost(receipt);
    statusEl.className = 'text-xs mt-2 text-center text-green-400';
    statusEl.textContent = t('donate.success');

    // Reset UI after a while
    setTimeout(() => {
      statusEl.classList.add('hidden');
      sendBtn.disabled = false;
      sendBtn.classList.add('hidden');
      document.querySelectorAll('#donate-amounts .donate-btn').forEach(b => b.classList.remove('selected'));
      document.getElementById('donate-custom-row').classList.add('hidden');
      _donateAmount = 0;
    }, 5000);

    // Refresh balances
    refreshBalance();
  } catch (e) {
    console.error('[Donation]', e);
    statusEl.className = 'text-xs mt-2 text-center text-red-400';
    statusEl.textContent = '❌ ' + (e.reason || e.message || t('donate.error'));
    sendBtn.disabled = false;
    setTimeout(() => statusEl.classList.add('hidden'), 6000);
  }
};

function updateDonateSymbols() {
  const sym = currencySymbol(getDisplayCurrency());
  document.querySelectorAll('.donate-sym').forEach(el => el.textContent = sym);
}

App.confirmDeleteWallet = async function() {
  if (state.isTwAuth) {
    const email = state.twEmail || localStorage.getItem(STORAGE.TW_EMAIL) || '';
    if (!confirm(t('settings.confirm_delete', {name: email}))) return;
    await App.twLogout();
    return;
  }
  if (!confirm(t('settings.confirm_delete_full'))) return;
  [
    STORAGE.ADDRESS,
    STORAGE.SEED_ENC,
    STORAGE.VAULTS_ENC,
    STORAGE.PIN_SALT,
    STORAGE.BIO_CRED_ID,
    STORAGE.BIO_PIN_ENC,
    STORAGE.BIO_TW_ENABLED,
    STORAGE.DELETED_VAULTS,
  ].forEach(k => localStorage.removeItem(k));
  Object.assign(state, { address: null, vaultKey: null, vaults: [], currentVaultId: null });
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
  syncNativePinInput('verify', state.pinVerifyBuffer);
  updatePinDotsVerify(state.pinVerifyBuffer.length);
  if (state.pinVerifyBuffer.length === 6) state.pinVerifyCallback?.(state.pinVerifyBuffer);
};

App.pinVerifyBackspace = function() {
  state.pinVerifyBuffer = state.pinVerifyBuffer.slice(0, -1);
  syncNativePinInput('verify', state.pinVerifyBuffer);
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
    const provider = state.walletSigner?.provider || getFallbackProvider();
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
  if (!amount || amount <= 0) { showError('deposit-error', t('deposit.error_amount')); return; }
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

  document.getElementById('lock-balance').textContent   = t('common.loading');
  document.getElementById('lock-balance').className     = 'text-slate-400 text-sm';
  document.getElementById('lock-status').textContent    = '';
  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = false;
  if (state._swapMode) {
    btn.textContent = t('deposit.convert_and_lock');
    btn.onclick = () => App.executeSwapAndLock();
  } else {
    btn.textContent = t('deposit.lock_btn');
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
        balEl.textContent = t('deposit.available', {bal: maticBal.toFixed(4), currency: 'MATIC'});
        balEl.className = maticBal >= amount ? 'text-green-400 text-sm' : 'text-red-400 text-sm';
      }
    } else if (srcToken) {
      const srcBal = await getTokenBalance(state.address, state._swapSrcSymbol);
      const balEl = document.getElementById('lock-balance');
      if (srcBal !== null) {
        balEl.textContent = t('deposit.available', {bal: srcBal.toFixed(4), currency: state._swapSrcSymbol});
        balEl.className = srcBal >= amount ? 'text-green-400 text-sm' : 'text-red-400 text-sm';
      } else {
        balEl.textContent = t('deposit.balance_unavailable');
      }
    }
  } else {
    const bal = await getTokenBalance(state.address, vault.currency);
    const balEl = document.getElementById('lock-balance');
    if (bal !== null) {
      balEl.textContent = t('deposit.available', {bal: bal.toFixed(2), currency: vault.currency});
      balEl.className   = bal >= amount ? 'text-green-400 text-sm' : 'text-red-400 text-sm';
    } else {
      balEl.textContent = t('deposit.balance_unavailable');
    }
  }
};

App.executeCaveauLock = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  if (!state.walletSigner) {
    showLockStatus('error', t('deposit.error_not_connected'));
    return;
  }

  // Check for zero MATIC → show onboarding modal
  if (!(await requireMatic())) return;

  const amount      = state.currentLockAmount;
  const tokenAddr   = TOKEN_ADDRESSES[vault.currency];
  if (!tokenAddr) { showLockStatus('error', t('deposit.unsupported_currency', {currency: vault.currency})); btn.disabled = false; return; }
  const decimals    = TOKEN_DECIMALS[vault.currency] || 6;
  const amountUnits = ethers.parseUnits(amount.toString(), decimals);

  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = true;

  // Gas check (low but not zero)
  const maticBal = await getMaticBalance();
  if (maticBal !== null && maticBal < 0.002) {
    showLockStatus('error', t('deposit.need_more_pol', {bal: maticBal.toFixed(4)}));
    btn.disabled = false;
    return;
  }

  // Vault must already be on-chain
  if (vault.onChainVaultId === undefined || vault.onChainVaultId === null) {
    showLockStatus('error', t('deposit.not_on_chain'));
    btn.disabled = false;
    return;
  }

  try {
    // Route to correct contract based on strategy
    const isAave = vault.strategy === 'aave';
    const contractAddr = isAave ? CAVEAU_AAVE_CONTRACT : CAVEAU_CONTRACT;
    const contractAbi  = isAave ? CAVEAU_AAVE_ABI : CAVEAU_ABI;
    const caveau = new ethers.Contract(contractAddr, contractAbi, state.walletSigner);
    const token  = new ethers.Contract(tokenAddr, ERC20_ABI, state.walletSigner);

    // Step 1: Approve token (to the correct contract)
    console.log('[Lock] strategy:', vault.strategy, 'contract:', contractAddr, 'token:', tokenAddr, 'vaultId:', vault.onChainVaultId, 'amount:', amountUnits.toString(), 'user:', state.address);

    // Read on-chain vault token to ensure we approve the right one
    const publicProvider = getFallbackProvider();
    let onChainToken = tokenAddr;
    try {
      const caveauRead = new ethers.Contract(contractAddr, ['function getVault(uint256) view returns (address,address,uint256)'], publicProvider);
      const vaultData = await caveauRead.getVault(vault.onChainVaultId);
      onChainToken = vaultData[1]; // token address from contract
      console.log('[Lock] On-chain vault token:', onChainToken, 'local token:', tokenAddr);
      if (onChainToken.toLowerCase() !== tokenAddr.toLowerCase()) {
        console.warn('[Lock] TOKEN MISMATCH! On-chain:', onChainToken, 'local:', tokenAddr);
        // Use the on-chain token for approve
      }
    } catch(e) { console.warn('[Lock] Could not read on-chain vault, using local token:', e.message); }

    const actualToken = new ethers.Contract(onChainToken, ERC20_ABI, state.walletSigner);
    showLockStatus('pending', t('deposit.step_approve'));
    const approveTx = await actualToken.approve(contractAddr, ethers.MaxUint256);
    showLockStatus('pending', t('deposit.step_approve_wait'));
    const approveReceipt = await approveTx.wait(); recordGasCost(approveReceipt);
    console.log('[Lock] Approve TX confirmed:', approveReceipt.hash, 'block:', approveReceipt.blockNumber);

    // Step 2: Deposit into on-chain vault
    showLockStatus('pending', isAave ? t('deposit.step_aave') : t('deposit.step_lock'));
    const depositTx = await caveau.deposit(vault.onChainVaultId, amountUnits);
    showLockStatus('pending', t('deposit.step_almost'));
    const receipt = await depositTx.wait(); recordGasCost(receipt);

    vault.transactions.push({
      id: uid(), date: new Date().toISOString(), amount,
      txHash: receipt.hash, onChain: true
    });
    await saveVaults();
    document.getElementById('deposit-amount').value = '';
    showLockStatus('success', isAave ? t('deposit.success_aave') : t('deposit.success'));
    btn.textContent = t('common.done');
    setTimeout(() => { App.closeModal('modal-caveau-lock'); renderVaultDetail(vault); renderDashboard(); refreshWalletBalance(false); App.openModal('modal-vault-detail'); }, 2500);
  } catch(err) {
    btn.disabled = false; btn.textContent = t('common.retry');
    showLockStatus('error', '❌ ' + (err.reason || err.shortMessage || err.message || t('common.error')).slice(0, 120));
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
  if (!res.ok) throw new Error(t('convert.quote_unavailable'));
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.priceRoute;
}

async function buildSwapTx(priceRoute, userAddress) {
  const body = {
    srcToken: priceRoute.srcToken, destToken: priceRoute.destToken,
    srcAmount: priceRoute.srcAmount,
    priceRoute, userAddress, slippage: 300,
  };
  console.log('[Paraswap] buildSwapTx request:', JSON.stringify(body).slice(0, 500));
  const res = await fetch(`${PARASWAP_API}/transactions/137`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error('[Paraswap] buildSwapTx error:', data);
    throw new Error(data.error || data.message || `Paraswap TX build failed (${res.status})`);
  }
  return data;
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
    lockBtn.textContent = t('deposit.lock_btn');

  } else if (method === 'btc' || method === 'eth') {
    // Cross-chain: BTC or ETH (main chips)
    const ccCoin = CROSS_CHAINS.find(c => c.symbol === method.toUpperCase());
    state._payMethod = 'crosschain';
    state._crossChainCoin = ccCoin;
    srcSelect.value = 'native';
    autoInfo.classList.remove('hidden');
    quoteBox.classList.add('hidden');
    lockBtn.textContent = t('deposit.deposit_with', {coin: ccCoin.label});

  } else if (method.startsWith('cc:')) {
    // Cross-chain: other coins (from "more" grid)
    const symbol = method.split(':')[1];
    const ccCoin = CROSS_CHAINS.find(c => c.symbol === symbol);
    state._payMethod = 'crosschain';
    state._crossChainCoin = ccCoin;
    srcSelect.value = 'native';
    autoInfo.classList.remove('hidden');
    quoteBox.classList.add('hidden');
    lockBtn.textContent = t('deposit.deposit_with', {coin: ccCoin.label});

  } else if (method.startsWith('swap:')) {
    // On-chain swap: wallet tokens (WETH, WBTC, etc.)
    const symbol = method.split(':')[1];
    state._payMethod = 'swap';
    state._crossChainCoin = null;
    srcSelect.value = symbol;
    autoInfo.classList.remove('hidden');
    quoteBox.classList.remove('hidden');
    lockBtn.textContent = t('deposit.convert_and_lock');
    App.fetchSwapPreview();
  }
};

App.toggleMorePayMethods = function() {
  const grid = document.getElementById('pay-more-grid');
  const btn = document.getElementById('pay-more-btn');
  if (grid.classList.contains('hidden')) {
    grid.classList.remove('hidden');
    btn.textContent = t('deposit.less_currencies');
  } else {
    grid.classList.add('hidden');
    btn.textContent = t('deposit.more_currencies');
  }
};

App.onSrcTokenChange = function() {
  const sel = document.getElementById('deposit-src-token').value;
  const quoteBox = document.getElementById('swap-quote-box');
  if (sel === 'native') {
    quoteBox.classList.add('hidden');
    document.getElementById('deposit-lock-btn').textContent = t('deposit.lock_btn');
  } else {
    quoteBox.classList.remove('hidden');
    document.getElementById('deposit-lock-btn').textContent = t('deposit.convert_and_lock');
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
  if (!vault || !state.walletSigner) { showLockStatus('error', t('deposit.error_not_connected')); return; }

  // Check for zero MATIC → show onboarding modal
  if (!(await requireMatic())) return;

  const srcSymbol = document.getElementById('deposit-src-token').value;
  const amount = state.currentLockAmount;
  const srcToken = SWAP_TOKENS.find(t => t.symbol === srcSymbol);
  if (!srcToken) { showLockStatus('error', t('deposit.src_not_found')); return; }
  const destAddr = TOKEN_ADDRESSES[vault.currency];
  if (!destAddr) { showLockStatus('error', t('deposit.unsupported_currency', {currency: vault.currency})); return; }
  const destDec  = TOKEN_DECIMALS[vault.currency] || 6;
  const srcAmountRaw = ethers.parseUnits(amount.toString(), srcToken.decimals).toString();
  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = true;

  // Gas check (low but not zero)
  const maticBal = await getMaticBalance();
  if (maticBal !== null && maticBal < 0.005) {
    showLockStatus('error', t('deposit.need_more_pol_swap', {bal: maticBal.toFixed(4)}));
    btn.disabled = false;
    return;
  }

  try {
    // Step 1: Get fresh quote
    showLockStatus('pending', t('deposit.swap_step1'));
    const route = await getSwapQuote(srcToken.address, destAddr, srcAmountRaw, srcToken.decimals, destDec);
    const swapTxData = await buildSwapTx(route, state.address);

    // Step 2: Approve source token (skip for native MATIC)
    if (srcToken.address !== NATIVE_TOKEN) {
      showLockStatus('pending', t('deposit.swap_step2'));
      const token = new ethers.Contract(srcToken.address, ERC20_ABI, state.walletSigner);
      const approveTx = await token.approve(swapTxData.to, ethers.MaxUint256);
      const rcptA2 = await approveTx.wait(); recordGasCost(rcptA2);
    }

    // Step 3: Execute swap
    showLockStatus('pending', t('deposit.swap_step3'));
    const txParams = {
      to: swapTxData.to, data: swapTxData.data,
      value: swapTxData.value || '0', gasLimit: swapTxData.gas || 500000n,
    };
    const swapTx = await state.walletSigner.sendTransaction(txParams);
    const rcptS = await swapTx.wait(); recordGasCost(rcptS);
    const destAmount = Number(ethers.formatUnits(route.destAmount, destDec));

    // Step 4: Now deposit the swapped tokens into Caveau (route by strategy)
    if (vault.onChainVaultId === undefined || vault.onChainVaultId === null) {
      showLockStatus('error', t('deposit.not_on_chain'));
      btn.disabled = false;
      return;
    }
    const isAave = vault.strategy === 'aave';
    const contractAddr = isAave ? CAVEAU_AAVE_CONTRACT : CAVEAU_CONTRACT;
    const contractAbi  = isAave ? CAVEAU_AAVE_ABI : CAVEAU_ABI;
    showLockStatus('pending', isAave ? t('deposit.swap_step4_aave') : t('deposit.swap_step4'));
    const caveau = new ethers.Contract(contractAddr, contractAbi, state.walletSigner);
    const destToken = new ethers.Contract(destAddr, ERC20_ABI, state.walletSigner);

    const depositUnits = ethers.parseUnits(destAmount.toFixed(destDec), destDec);
    const approveCaveauTx = await destToken.approve(contractAddr, depositUnits);
    const rcptA3 = await approveCaveauTx.wait(); recordGasCost(rcptA3);
    const depTx = await caveau.deposit(vault.onChainVaultId, depositUnits);
    const receipt = await depTx.wait(); recordGasCost(receipt);

    vault.transactions.push({ id: uid(), date: new Date().toISOString(), amount: destAmount, txHash: receipt.hash, onChain: true, swappedFrom: srcSymbol });
    await saveVaults();
    document.getElementById('deposit-amount').value = '';
    showLockStatus('success', t('deposit.swap_success', {amount, src: srcSymbol, dest: destAmount.toFixed(2), currency: vault.currency}));
    btn.textContent = t('common.done');
    setTimeout(() => { App.closeModal('modal-caveau-lock'); renderVaultDetail(vault); renderDashboard(); refreshWalletBalance(false); App.openModal('modal-vault-detail'); }, 2500);
  } catch(err) {
    btn.disabled = false; btn.textContent = t('common.retry');
    showLockStatus('error', '❌ ' + (err.reason || err.shortMessage || err.message || t('common.error')).slice(0, 140));
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
  document.getElementById('cc-deposit-address').textContent = t('cc.creating');
  document.getElementById('cc-status').textContent = t('cc.creating_order');
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
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || t('cc.error_sideshift')); }
    const shift = await res.json();
    document.getElementById('cc-deposit-address').textContent = shift.depositAddress;
    const limTxt = shift.depositMin ? `Min: ${shift.depositMin} ${coin.symbol}` : '';
    const limMax = shift.depositMax ? ` · Max: ${shift.depositMax} ${coin.symbol}` : '';
    document.getElementById('cc-limits').textContent = limTxt + limMax;
    document.getElementById('cc-status').textContent = t('cc.waiting');
    state._currentShiftId = shift.id;
    ccPollInterval = setInterval(() => App.pollShiftStatus(shift.id, vault), 10000);
  } catch(err) {
    document.getElementById('cc-deposit-address').textContent = '—';
    document.getElementById('cc-status').textContent = '❌ ' + (err.message || t('common.error')).slice(0, 100);
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
      statusEl.textContent = t('cc.waiting');
      statusEl.className = 'text-sm font-medium text-yellow-400';
    } else if (shift.status === 'pending' || shift.status === 'processing') {
      statusEl.textContent = t('cc.converting');
      statusEl.className = 'text-sm font-medium text-blue-400';
    } else if (shift.status === 'review') {
      statusEl.textContent = t('cc.reviewing');
      statusEl.className = 'text-sm font-medium text-orange-400';
    } else if (shift.status === 'settled') {
      statusEl.textContent = t('cc.completed', {amount: shift.settleAmount, currency: vault.currency});
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
      statusEl.textContent = '❌ ' + (shift.status === 'expired' ? t('cc.expired') : t('cc.refunded'));
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
  if (vault) { renderVaultDetail(vault); renderDashboard(); refreshWalletBalance(false); App.openModal('modal-vault-detail'); }
};

// ─── MATIC Onboarding ────────────────────────────────────────
const MATIC_ONBOARD_SKIP_KEY = 'caveau_matic_onboard_skip';

async function checkMaticOnboarding() {
  if (!state.address) return;
  // Don't show again if user dismissed it and has already seen it
  const skipped = localStorage.getItem(MATIC_ONBOARD_SKIP_KEY);
  if (skipped === '1') return;
  try {
    const bal = await getMaticBalance();
    if (bal !== null && bal < 0.001) {
      // Show onboarding modal
      const addrEl = document.getElementById('onboard-wallet-addr');
      if (addrEl) addrEl.textContent = state.address;
      openModal('modal-matic-onboard');
    }
  } catch(e) { console.warn('[MaticOnboard] check failed:', e); }
}

App.checkOnboardMatic = async function() {
  const statusEl = document.getElementById('onboard-matic-status');
  statusEl.textContent = t('onboard.checking');
  statusEl.className = 'text-center text-sm mb-3 text-yellow-400';
  try {
    const bal = await getMaticBalance();
    if (bal !== null && bal >= 0.001) {
      statusEl.textContent = t('onboard.found_pol', {bal: bal.toFixed(4)});
      statusEl.className = 'text-center text-sm mb-3 text-green-400 font-semibold';
      localStorage.setItem(MATIC_ONBOARD_SKIP_KEY, '1');
      setTimeout(() => { closeModal('modal-matic-onboard'); }, 1500);
    } else {
      statusEl.textContent = t('onboard.not_arrived', {bal: bal !== null ? bal.toFixed(4) : '0'});
      statusEl.className = 'text-center text-sm mb-3 text-amber-400';
    }
  } catch(e) {
    statusEl.textContent = t('onboard.check_error');
    statusEl.className = 'text-center text-sm mb-3 text-red-400';
  }
};

App.skipOnboardMatic = function() {
  localStorage.setItem(MATIC_ONBOARD_SKIP_KEY, '1');
  closeModal('modal-matic-onboard');
};

// Convert excess POL → USDC from dashboard
App.convertExcessPol = async function() {
  if (!state.walletSigner) return;
  const btn = document.getElementById('pol-convert-btn');
  const polStatus = document.getElementById('gas-status');
  const origBtnText = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  const setStatus = (txt, cls) => { if (polStatus) { polStatus.textContent = txt; if (cls) polStatus.className = cls; } };

  try {
    const provider = state.walletSigner.provider;
    const rawBal = await provider.getBalance(state.address);
    const polBal = Number(ethers.formatEther(rawBal));
    const excess = polBal - POL_KEEP;
    if (excess <= 0.5) {
      setStatus(t('convert.nothing'));
      if (btn) { btn.disabled = false; btn.textContent = origBtnText; }
      return;
    }

    // Leave a small buffer for gas costs of this swap tx (~0.01 POL)
    const swapAmount = excess - 0.05;
    const swapWei = ethers.parseEther(swapAmount.toFixed(6)).toString();

    setStatus(t('convert.quoting'));
    console.log('[ConvertPOL] Swapping', swapAmount.toFixed(4), 'POL → USDC, wei:', swapWei);
    const route = await getSwapQuote(NATIVE_TOKEN, TOKEN_ADDRESSES.USDC, swapWei, 18, 6);
    console.log('[ConvertPOL] Quote OK, destAmount:', route.destAmount);

    setStatus(t('convert.preparing'));
    const swapTxData = await buildSwapTx(route, state.address);
    console.log('[ConvertPOL] TX built, to:', swapTxData.to, 'value:', swapTxData.value);

    setStatus(t('convert.sending'));
    const tx = await state.walletSigner.sendTransaction({
      to: swapTxData.to,
      data: swapTxData.data,
      value: swapTxData.value || swapWei,
      gasLimit: BigInt(swapTxData.gas || 500000),
    });
    console.log('[ConvertPOL] TX sent:', tx.hash);
    setStatus(t('convert.confirming'));
    const rcptC = await tx.wait(); recordGasCost(rcptC);

    const usdcReceived = Number(ethers.formatUnits(route.destAmount, 6));
    setStatus(`✅ +$${usdcReceived.toFixed(2)} USDC`, 'text-[10px] text-emerald-400 font-semibold');
    if (btn) btn.classList.add('hidden');
    await refreshWalletBalance(false);
    await renderDashboard();
  } catch(err) {
    console.error('[ConvertPOL] FULL ERROR:', err);
    const reason = err?.info?.error?.message || err?.reason || err?.shortMessage || err?.message || t('common.error');
    setStatus('❌ ' + reason.slice(0, 50), 'text-[10px] text-red-400');
    if (btn) { btn.disabled = false; btn.textContent = origBtnText; }
  }
};

App.copyOnboardAddress = function() {
  if (!state.address) return;
  navigator.clipboard.writeText(state.address).then(() => {
    const btn = document.getElementById('onboard-copy-btn');
    if (btn) { btn.textContent = t('common.copied'); setTimeout(() => { btn.textContent = t('common.copy'); }, 2000); }
  });
};

// Self-send in on-ramp modal
const POL_KEEP = 3; // keep max 3 POL for gas, swap rest to USDC
const _selfSend = { polBefore: 0, stableBefore: 0, openedAt: 0 };

App.showSelfSend = async function() {
  ['onramp-choose-text', 'onramp-providers', 'onramp-provider-notice', 'onramp-next-steps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  document.getElementById('onramp-self-send').classList.remove('hidden');
  const addr = document.getElementById('onramp-self-addr');
  if (addr && state.address) addr.textContent = state.address;
  // Snapshot balances for later comparison
  _selfSend.openedAt = Date.now();
  try {
    const provider = state.walletSigner?.provider || getFallbackProvider();
    _selfSend.polBefore = Number(ethers.formatEther(await provider.getBalance(state.address)));
    const tokens = ['USDC','DAI','USDT','EURe','ZCHF'];
    const results = await Promise.allSettled(
      tokens.map(t => new ethers.Contract(TOKEN_ADDRESSES[t], ERC20_ABI, provider)
        .balanceOf(state.address).then(r => Number(ethers.formatUnits(r, TOKEN_DECIMALS[t] || 6))))
    );
    _selfSend.stableBefore = results.reduce((s, r) => s + (r.status === 'fulfilled' ? r.value : 0), 0);
  } catch(e) { console.warn('[SelfSend] snapshot failed:', e); }
};

App.hideSelfSend = function() {
  document.getElementById('onramp-self-send').classList.add('hidden');
  ['onramp-choose-text', 'onramp-providers', 'onramp-provider-notice', 'onramp-next-steps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  });
};

App.copySelfSendAddr = function() {
  if (!state.address) return;
  navigator.clipboard.writeText(state.address).then(() => {
    const btn = document.getElementById('self-send-copy-btn');
    if (btn) { btn.textContent = t('common.copied'); setTimeout(() => { btn.textContent = t('common.copy'); }, 2000); }
  });
};

// Intercept vault creation & deposit if no MATIC
async function requireMatic(errorElId) {
  const bal = await getMaticBalance();
  if (bal !== null && bal < 0.001) {
    // Reset skip so onboarding shows again
    localStorage.removeItem(MATIC_ONBOARD_SKIP_KEY);
    const addrEl = document.getElementById('onboard-wallet-addr');
    if (addrEl) addrEl.textContent = state.address;
    openModal('modal-matic-onboard');
    return false;
  }
  return true;
}

// ─── FASE 3: Auto-MATIC (Gasless UX) ────────────────────────
async function getMaticBalance() {
  try {
    const provider = state.walletSigner?.provider || getFallbackProvider();
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
  if (!state.walletSigner) { showError('deposit-error', t('deposit.error_not_connected')); return; }
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const destAddr = TOKEN_ADDRESSES[vault.currency];
  const destDec = TOKEN_DECIMALS[vault.currency] || 6;
  const maticNeeded = ethers.parseUnits('0.5', destDec);
  const warn = document.getElementById('matic-warning');

  try {
    warn.innerHTML = t('automatic.preparing');
    const route = await getSwapQuote(destAddr, NATIVE_TOKEN, maticNeeded.toString(), destDec, 18);
    const swapTxData = await buildSwapTx(route, state.address);
    const token = new ethers.Contract(destAddr, ERC20_ABI, state.walletSigner);
    const approveTx = await token.approve(swapTxData.to, maticNeeded);
    const rcptAM = await approveTx.wait(); recordGasCost(rcptAM);
    const tx = await state.walletSigner.sendTransaction({
      to: swapTxData.to, data: swapTxData.data, value: swapTxData.value || '0',
      gasLimit: swapTxData.gas || 400000n,
    });
    const rcptM = await tx.wait(); recordGasCost(rcptM);
    warn.innerHTML = t('automatic.ready');
    warn.className = 'bg-green-500/10 border border-green-500/30 text-green-400 text-xs p-2 rounded-xl mb-2';
    setTimeout(() => warn.classList.add('hidden'), 3000);
  } catch(err) {
    warn.innerHTML = t('automatic.error', {error: (err.reason || err.message || t('common.error')).slice(0,80)});
    warn.className = 'bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-2 rounded-xl mb-2';
  }
};

// ─── Helpers ─────────────────────────────────────────────────
function vaultTotal(vault) {
  return vault.transactions.reduce((s,t) => s+t.amount, 0);
}

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const d = parseDateInput(dateStr);
  if (!d || isNaN(d)) return Infinity;
  return Math.ceil((d - new Date()) / 86400000);
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
  const modes = getUnlockModes(); return (modes[mode] || modes[0]).label;
}

App.setUnlockMode = function(mode) {
  state.selectedUnlockMode = mode;
  document.querySelectorAll('.unlock-mode-btn').forEach((btn, i) => {
    if (i === mode) {
      btn.style.border = '2px solid #3b82f6';
      btn.style.background = 'rgba(59,130,246,.1)';
      btn.style.color = '#60a5fa';
    } else {
      btn.style.border = '2px solid rgba(51,65,85,.6)';
      btn.style.background = 'transparent';
      btn.style.color = '#64748b';
    }
  });
  document.getElementById('mode-hint').textContent = getUnlockModes()[mode].hint;
  const showDate   = mode === 0 || mode === 2 || mode === 3;
  const showTarget = mode === 1 || mode === 2 || mode === 3;
  document.getElementById('vault-date-row').classList.toggle('hidden', !showDate);
  document.getElementById('vault-target-row').classList.toggle('hidden', !showTarget);
};

function toLocalDatetimeString(d) {
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDateInput(dateStr) {
  if (!dateStr) return null;
  // datetime-local: "2026-03-01T18:30" → parsed as local time
  if (dateStr.includes('T')) return new Date(dateStr);
  // legacy date-only: "2026-03-01" → midnight local time
  return new Date(dateStr + 'T00:00:00');
}

function fmtDate(dateStr) {
  const d = parseDateInput(dateStr);
  if (!d || isNaN(d)) return '—';
  const hasTime = dateStr && dateStr.includes('T') && !dateStr.endsWith('T00:00');
  const opts = { day:'2-digit', month:'short', year:'numeric' };
  if (hasTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleDateString('it-IT', opts);
}

function fmtDateShort(dateStr) {
  const d = parseDateInput(dateStr);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('it-IT', { month:'short', year:'2-digit' });
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

// ─── Thirdweb Auth ──────────────────────────────────────────

async function initThirdwebSDK() {
  if (THIRDWEB_CLIENT_ID === 'YOUR_THIRDWEB_CLIENT_ID') {
    console.warn('[Thirdweb] Client ID non configurato.');
    return false;
  }
  // Wait for SDK if not yet loaded (max 8s)
  if (!window.__ThirdwebSDK) {
    await new Promise((resolve) => {
      if (window.__twLoadError) { resolve(); return; }
      const handler = () => { window.removeEventListener('thirdweb-sdk-ready', handler); resolve(); };
      window.addEventListener('thirdweb-sdk-ready', handler);
      setTimeout(resolve, 8000);
    });
  }
  if (!window.__ThirdwebSDK || !window.__ThirdwebSDK.createThirdwebClient) {
    console.warn('[Thirdweb] SDK non disponibile');
    return false;
  }
  try {
    state.twClient = window.__ThirdwebSDK.createThirdwebClient({
      clientId: THIRDWEB_CLIENT_ID,
    });
    state.twWallet = window.__ThirdwebSDK.inAppWallet();
    state.twReady = true;
    return true;
  } catch(e) {
    console.error('[Thirdweb] Init failed:', e);
    return false;
  }
}

App.twStartLogin = async function() {
  if (!state.twReady) {
    const btn = document.getElementById('btn-tw-login');
    const origText = btn.textContent;
    btn.textContent = t('common.loading');
    btn.disabled = true;
    const ok = await initThirdwebSDK();
    btn.disabled = false;
    if (!ok) {
      btn.textContent = origText;
      alert(t('tw.sdk_unavailable'));
      return;
    }
    btn.textContent = origText;
  }
  showScreen('screen-tw-email');
  setTimeout(() => document.getElementById('tw-email-input')?.focus(), 120);
};

App.twSendCode = async function() {
  const emailInput = document.getElementById('tw-email-input');
  const email = (emailInput.value || '').trim().toLowerCase();
  if (!email || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(email)) {
    showError('tw-email-error', t('tw.invalid_email'));
    return;
  }
  const btn = document.getElementById('tw-send-btn');
  btn.textContent = t('tw.sending');
  btn.disabled = true;
  try {
    state.twEmail = email;
    // Thirdweb: send email verification code
    await window.__ThirdwebSDK.preAuthenticate({
      client: state.twClient,
      strategy: 'email',
      email: email,
    });
    document.getElementById('tw-otp-email-display').textContent = email;
    showScreen('screen-tw-otp');
    setTimeout(() => document.getElementById('tw-otp-input')?.focus(), 120);
  } catch(e) {
    console.error('[Thirdweb] sendCode error:', e);
    showError('tw-email-error', t('tw.send_error'));
  } finally {
    btn.textContent = t('tw.send_code');
    btn.disabled = false;
  }
};

App.twVerifyCode = async function() {
  const otpInput = document.getElementById('tw-otp-input');
  const code = (otpInput.value || '').trim();
  if (!code || code.length < 4) {
    showError('tw-otp-error', t('tw.enter_code'));
    return;
  }
  const btn = document.getElementById('tw-verify-btn');
  btn.textContent = t('tw.verifying');
  btn.disabled = true;
  try {
    // Thirdweb: verify OTP and connect wallet
    const account = await state.twWallet.connect({
      client: state.twClient,
      chain: window.__ThirdwebSDK.polygon,
      strategy: 'email',
      email: state.twEmail,
      verificationCode: code,
    });
    state.twAccount = account;
    showScreen('screen-tw-loading');
    await handleTwAuthSuccess(account);
  } catch(e) {
    console.error('[Thirdweb] verify error:', e);
    const msg = (e.message || '').toLowerCase().includes('invalid')
      ? t('tw.wrong_code')
      : t('tw.verify_error');
    showError('tw-otp-error', msg);
    otpInput.value = '';
    otpInput.focus();
  } finally {
    btn.textContent = t('tw.verify_btn');
    btn.disabled = false;
  }
};

App.twResendCode = async function() {
  if (!state.twEmail) return;
  try {
    await window.__ThirdwebSDK.preAuthenticate({
      client: state.twClient,
      strategy: 'email',
      email: state.twEmail,
    });
    showError('tw-otp-error', '');
    const el = document.getElementById('tw-otp-error');
    el.textContent = t('tw.code_resent');
    el.classList.remove('hidden');
    el.className = el.className.replace('bg-red-500/10 border-red-500/30 text-red-400', 'bg-green-500/10 border-green-500/30 text-green-400');
    setTimeout(() => {
      el.classList.add('hidden');
      el.className = el.className.replace('bg-green-500/10 border-green-500/30 text-green-400', 'bg-red-500/10 border-red-500/30 text-red-400');
    }, 3000);
  } catch(e) {
    showError('tw-otp-error', t('tw.resend_error'));
  }
};

App.twBackToEmail = function() {
  showScreen('screen-tw-email');
};

async function handleTwAuthSuccess(account) {
  const loadMsg = document.getElementById('tw-loading-msg');
  try {
    loadMsg.textContent = t('tw.auth_success');
    const walletAddress = account.address;

    // Store auth state
    state.address = walletAddress;
    state.isTwAuth = true;
    localStorage.setItem(STORAGE.ADDRESS, walletAddress);
    localStorage.setItem(STORAGE.TW_AUTH_MODE, '1');
    localStorage.setItem(STORAGE.TW_EMAIL, state.twEmail);

    // Derive vault encryption key from wallet address (deterministic)
    state.vaultKey = await deriveKeyFromString(walletAddress.toLowerCase(), 'caveau-vaults-v1-' + walletAddress);

    // Get ethers signer via Thirdweb adapter
    try {
      loadMsg.textContent = 'Connessione al portafoglio Polygon...';
      state.walletSigner = await window.__ThirdwebSDK.ethers6Adapter.signer.toEthers({
        client: state.twClient,
        chain: window.__ThirdwebSDK.polygon,
        account: account,
      });
      console.log('[Thirdweb] Wallet signer ready on Polygon');
    } catch(e) {
      console.warn('[Thirdweb] Signer setup failed (non-critical):', e);
    }

    // Load existing vaults if any
    await loadVaults();

    loadMsg.textContent = t('tw.all_ready');
    setTimeout(() => {
      showDashboard();
      // Prompt passkey enrollment if not yet enrolled for THIS email
      const passkeyEmail = localStorage.getItem('caveau_tw_passkey_email');
      if (!passkeyEmail || passkeyEmail !== state.twEmail) {
        setTimeout(() => openModal('modal-passkey-prompt'), 600);
      } else {
        // Passkey already enrolled — prompt biometric gate if not yet configured
        maybePromptBiometricOptInTw();
      }
    }, 400);
  } catch(e) {
    console.error('[Thirdweb] Auth success handler error:', e);
    loadMsg.textContent = t('tw.error_retry');
    setTimeout(() => showScreen('screen-welcome'), 2000);
  }
}

async function tryTwSessionRestore() {
  const isTw = localStorage.getItem(STORAGE.TW_AUTH_MODE) === '1';
  if (!isTw) return false;
  const savedAddress = localStorage.getItem(STORAGE.ADDRESS);
  const twEmail = localStorage.getItem(STORAGE.TW_EMAIL);
  if (!savedAddress) return false;

  // Initialize Thirdweb SDK
  const sdkReady = await initThirdwebSDK();

  if (sdkReady) {
    // Try to restore session via Thirdweb autoConnect
    try {
      const account = await state.twWallet.autoConnect({
        client: state.twClient,
        chain: window.__ThirdwebSDK.polygon,
      });
      if (account) {
        state.twAccount = account;
        state.address = account.address;
        state.isTwAuth = true;
        state.twEmail = twEmail || '';
        state.vaultKey = await deriveKeyFromString(account.address.toLowerCase(), 'caveau-vaults-v1-' + account.address);

        // Restore signer
        try {
          state.walletSigner = await window.__ThirdwebSDK.ethers6Adapter.signer.toEthers({
            client: state.twClient,
            chain: window.__ThirdwebSDK.polygon,
            account: account,
          });
          console.log('[Thirdweb] Signer restored on Polygon');
        } catch(e) {
          console.warn('[Thirdweb] Signer restore failed (non-critical):', e);
        }

        await loadVaults();
        return true;
      }
    } catch {
      // Session expired
    }
  }

  // Fallback: load vaults with stored address (read-only, no signer)
  state.address = savedAddress;
  state.isTwAuth = true;
  state.twEmail = twEmail || '';
  state.vaultKey = await deriveKeyFromString(savedAddress.toLowerCase(), 'caveau-vaults-v1-' + savedAddress);
  await loadVaults();
  return true;
}

App.twLogout = async function() {
  try {
    if (state.twWallet) {
      await state.twWallet.disconnect();
    }
  } catch { /* ignore */ }
  localStorage.removeItem(STORAGE.TW_AUTH_MODE);
  localStorage.removeItem(STORAGE.TW_EMAIL);
  localStorage.removeItem(STORAGE.ADDRESS);
  localStorage.removeItem(STORAGE.VAULTS_ENC);
  localStorage.removeItem(STORAGE.DELETED_VAULTS);
  // Keep caveau_tw_passkey_email — it's device-level, survives logout
  clearTwStorage();
  state.address = null;
  state.vaultKey = null;
  state.vaults = [];
  state.walletSigner = null;
  state.twAccount = null;
  state.twClient = null;
  state.twWallet = null;
  state.twReady = false;
  state.isTwAuth = false;
  state.twEmail = '';
  window.location.reload();
};

// ─── Passkey ────────────────────────────────────────────────

App.enrollPasskey = async function() {
  if (!state.twClient || !state.twAccount) {
    alert(t('tw.must_auth_passkey'));
    return;
  }
  closeModal('modal-passkey-prompt');
  const settingsBtn = document.getElementById('passkey-enroll-btn');
  if (settingsBtn) { settingsBtn.textContent = t('tw.registering'); settingsBtn.disabled = true; }
  try {
    await window.__ThirdwebSDK.linkProfile({
      client: state.twClient,
      strategy: 'passkey',
      type: 'sign-up',
    });
    localStorage.setItem('caveau_tw_passkey_email', state.twEmail);
    updatePasskeyUI();
    alert(t('tw.passkey_activated'));
  } catch(e) {
    console.error('[Thirdweb] Passkey enrollment error:', e);
    if (settingsBtn) { settingsBtn.textContent = t('tw.enroll_passkey_btn'); settingsBtn.disabled = false; }
    if (e.name !== 'NotAllowedError') {
      alert(t('tw.passkey_error', {error: e.message || t('common.retry')}));
    }
  }
};

App.dismissPasskeyPrompt = function() {
  closeModal('modal-passkey-prompt');
};

App.loginWithPasskey = async function() {
  if (!state.twReady) {
    const ok = await initThirdwebSDK();
    if (!ok) { alert(t('tw.sdk_unavailable')); return; }
  }
  const btn = document.getElementById('btn-tw-passkey');
  if (btn) { btn.textContent = t('tw.verifying'); btn.disabled = true; }
  try {
    const passkeyWallet = window.__ThirdwebSDK.inAppWallet();
    const account = await passkeyWallet.connect({
      client: state.twClient,
      chain: window.__ThirdwebSDK.polygon,
      strategy: 'passkey',
      type: 'sign-in',
    });
    state.twWallet = passkeyWallet;
    state.twAccount = account;
    // Recover email from Thirdweb profiles
    try {
      const profiles = await window.__ThirdwebSDK.getProfiles({ client: state.twClient });
      const emailProfile = profiles.find(p => p.type === 'email');
      if (emailProfile && emailProfile.details && emailProfile.details.email) {
        state.twEmail = emailProfile.details.email;
        localStorage.setItem(STORAGE.TW_EMAIL, state.twEmail);
      }
    } catch(pe) {
      console.warn('[Thirdweb] Could not fetch profiles:', pe);
      state.twEmail = localStorage.getItem(STORAGE.TW_EMAIL) || '';
    }
    // Update passkey email flag
    if (state.twEmail) localStorage.setItem('caveau_tw_passkey_email', state.twEmail);
    showScreen('screen-tw-loading');
    await handleTwAuthSuccess(account);
  } catch(e) {
    console.error('[Thirdweb] Passkey login error:', e);
    if (btn) { btn.textContent = t('tw.login_passkey_btn'); btn.disabled = false; }
    if (e.name !== 'NotAllowedError') {
      alert(t('tw.passkey_login_error', {error: e.message || t('common.retry')}));
    }
  }
};

function updatePasskeyUI() {
  const section = document.getElementById('settings-passkey-section');
  if (!section) return;
  if (!state.isTwAuth) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  const enrollBtn = document.getElementById('passkey-enroll-btn');
  const statusEl = document.getElementById('passkey-status');
  if (!enrollBtn || !statusEl) return;

  const passkeyEmail = localStorage.getItem('caveau_tw_passkey_email');
  const hasPasskey = passkeyEmail && passkeyEmail === (state.twEmail || localStorage.getItem(STORAGE.TW_EMAIL));
  if (hasPasskey) {
    enrollBtn.textContent = t('tw.passkey_active');
    enrollBtn.disabled = true;
    enrollBtn.className = 'w-full bg-green-500/10 border border-green-500/30 text-green-400 py-3 rounded-xl text-sm font-medium cursor-default';
    statusEl.textContent = t('tw.passkey_active_desc');
    statusEl.className = 'text-green-400/80 text-xs mt-1';
  } else {
    enrollBtn.textContent = t('tw.enroll_passkey_btn');
    enrollBtn.disabled = false;
    enrollBtn.className = 'w-full bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-400 py-3 rounded-xl text-sm font-medium transition-colors';
    statusEl.textContent = t('tw.passkey_enroll_desc');
    statusEl.className = 'text-slate-400 text-xs mt-1';
  }

  // Show/hide passkey login button on welcome screen
  const passkeyLoginBtn = document.getElementById('btn-tw-passkey');
  if (passkeyLoginBtn) {
    passkeyLoginBtn.classList.toggle('hidden', !hasPasskey);
  }
}

// ─── App Lock Screen (resume from background) ───────────────
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
let _backgroundTimestamp = null;

function initAppLockListener() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _backgroundTimestamp = Date.now();
    } else {
      if (!_backgroundTimestamp || !state.address) return;
      const elapsed = Date.now() - _backgroundTimestamp;
      _backgroundTimestamp = null;
      if (elapsed >= LOCK_TIMEOUT_MS) {
        showAppLockScreen();
      }
    }
  });
}

function showAppLockScreen() {
  // TW users without biometric: no lock (Thirdweb session handles security)
  if (isTwUser() && !isBioConfigured()) return;

  const lockEl = document.getElementById('app-lock-screen');
  if (!lockEl) return;
  lockEl.style.display = 'flex';

  const bioBtn = document.getElementById('lock-screen-bio-btn');
  const pinBtn = document.getElementById('lock-screen-pin-btn');
  const reloginBtn = document.getElementById('lock-screen-relogin-btn');
  const bioConfigured = isBioConfigured();

  // TW users: biometric only, no PIN button, show re-login fallback
  if (isTwUser()) {
    if (bioBtn) bioBtn.style.display = bioConfigured ? 'block' : 'none';
    if (pinBtn) pinBtn.style.display = 'none';
    if (reloginBtn) reloginBtn.style.display = '';
  } else {
    // Classic users: show bio if configured, always show PIN, no re-login
    if (bioBtn) bioBtn.style.display = bioConfigured ? 'block' : 'none';
    if (pinBtn) pinBtn.style.display = '';
    if (reloginBtn) reloginBtn.style.display = 'none';
  }

  if (typeof applyTranslations === 'function') applyTranslations();

  // Auto-trigger biometric if available
  if (bioConfigured) setTimeout(() => App.unlockLockScreen('bio'), 300);
}

function hideAppLockScreen() {
  const lockEl = document.getElementById('app-lock-screen');
  if (lockEl) lockEl.style.display = 'none';
  // TW cold start: biometric passed, now show dashboard
  if (state._twDashboardPending) {
    state._twDashboardPending = false;
    showDashboard();
  }
}

App.unlockLockScreen = async function(method) {
  if (method === 'bio') {
    try {
      if (isTwUser()) {
        // TW user: pure WebAuthn verification, no PIN
        await verifyBiometric();
      } else {
        // Classic user: biometric decrypts PIN
        await App.unlockWithBiometric();
      }
      hideAppLockScreen();
    } catch {
      // Biometric failed — TW user can retry, classic user can try PIN
    }
  } else {
    // PIN flow (classic users only): use the existing pin-verify modal
    state.pinVerifyBuffer = '';
    syncNativePinInput('verify', '');
    updatePinDotsVerify(0);
    document.getElementById('pin-verify-error').classList.add('hidden');
    state.pinVerifyCallback = async (pin) => {
      const salt = localStorage.getItem(STORAGE.PIN_SALT);
      try {
        const pinKey = await deriveKeyFromString(pin, 'caveau-pin-' + salt);
        const blob = localStorage.getItem(STORAGE.SEED_ENC);
        if (blob) await decrypt(pinKey, blob); // verify PIN is correct
        App.closeModal('modal-pin-verify');
        hideAppLockScreen();
      } catch {
        state.pinVerifyBuffer = '';
        syncNativePinInput('verify', '');
        updatePinDotsVerify(0);
        showError('pin-verify-error', t('pin.wrong'));
      }
    };
    App.openModal('modal-pin-verify');
    setTimeout(() => document.getElementById('pin-native-verify')?.focus(), 120);
  }
};

// ─── Init ────────────────────────────────────────────────────

(async function init() {
  // Initialize Framework7
  f7app = new Framework7({
    el: '#app',
    name: 'PiggyVault',
    theme: 'auto',
    darkMode: true,
    colors: { primary: '#3b82f6' },
    sheet: {
      backdrop: true,
      closeByBackdropClick: true,
      swipeToClose: true,
      swipeHandler: '.sheet-handle',
    },
    touch: { tapHold: false },
  });

  // F7 tab events — run tab-specific init when F7 switches tabs
  const tabSettings = document.getElementById('tab-settings');
  const tabStats = document.getElementById('tab-stats');
  if (tabSettings) tabSettings.addEventListener('tab:show', () => App._initSettingsTab());
  if (tabStats) tabStats.addEventListener('tab:show', () => {
    renderExtraStats();
    const cs = document.getElementById('chart-section');
    if (cs && state.vaults && state.vaults.length > 0) { cs.classList.remove('hidden'); renderDashChart(); }
    else if (cs) { cs.classList.add('hidden'); }
  });

  // App lock on resume from background
  initAppLockListener();

  // Check for Thirdweb session first
  const twRestored = await tryTwSessionRestore();
  if (twRestored) {
    // TW session OK — biometric gate if configured, else straight to dashboard
    if (isBioConfigured()) {
      // Show lock screen with biometric only (no PIN)
      showAppLockScreen();
      // Dashboard will show after biometric verification succeeds
      state._twDashboardPending = true;
    } else {
      showDashboard();
      maybePromptBiometricOptInTw();
    }
  } else {
    // Clean any stale storage on fresh start at welcome screen
    clearTwStorage();
    // Fallback to classic PIN-based auth check
    const savedAddress = localStorage.getItem(STORAGE.ADDRESS);
    const seedBlob = localStorage.getItem(STORAGE.SEED_ENC);
    if (savedAddress && seedBlob) {
      const short = savedAddress.slice(0,6) + '…' + savedAddress.slice(-4);
      document.getElementById('unlock-address-short').textContent = short;
      showScreen('screen-unlock');
      updateBiometricUI();
      // Auto-trigger biometric on cold start if configured (classic users only)
      const hasBio = hasBiometricCapability() && !!localStorage.getItem(STORAGE.BIO_CRED_ID) && !!localStorage.getItem(STORAGE.BIO_PIN_ENC);
      if (hasBio) setTimeout(() => App.unlockWithBiometric(), 400);
    } else {
      showScreen('screen-welcome');
      // Show passkey login button if a passkey was enrolled on this device
      const passkeyBtn = document.getElementById('btn-tw-passkey');
      const passkeyEmail = localStorage.getItem('caveau_tw_passkey_email');
      if (passkeyBtn && passkeyEmail) {
        passkeyBtn.classList.remove('hidden');
        passkeyBtn.textContent = t('tw.login_as', {email: passkeyEmail});
      }
    }
  }

  window.addEventListener('pageshow', () => {
    if (!state.address) return;
    const active = document.querySelector('.screen.active');
    if (!active) showDashboard();
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    updateInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    localStorage.setItem(STORAGE.INSTALL_BANNER_HIDE, '1');
    updateInstallBanner();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED' && event.data?.version) {
        updateBuildBadge(`SW ${event.data.version}`);
      }
    });
  }

  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const isFormField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    if (!isFormField) return;
    if (!target.closest('.modal-overlay.active') && !target.closest('.sheet-modal.modal-in')) return;
    setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, 120);
  }, true);

  updateInstallBanner();
  updateBuildBadge();
  if (window._splashHide) window._splashHide();
})();
