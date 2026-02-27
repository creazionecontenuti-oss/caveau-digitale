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
const POLYGON_RPC     = 'https://polygon-rpc.com';
const SABLIER_LOCKUP  = '0xE0BFe071Da104e571298f8b6e0fcE44C512C1Ff4'; // SablierLockup v2.0
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
const SABLIER_ABI = [
  'function createWithTimestampsLT((address sender,address recipient,uint128 totalAmount,address asset,bool cancelable,bool transferable,(uint40 start,uint40 end) timestamps,(address account,uint256 fee) broker) params,(uint128 amount,uint40 timestamp)[] tranches) external payable returns (uint256 streamId)'
];

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
  currentLockAmount: 0
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
    document.getElementById('set-pin-desc').textContent = 'Scegli un PIN di 6 cifre per sbloccare il Caveau rapidamente.';
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
  document.getElementById('set-pin-desc').textContent = 'Scegli un PIN di 6 cifre per sbloccare il Caveau rapidamente.';
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
  document.getElementById('restore-title').textContent = 'Ripristina Portafoglio';
  document.getElementById('restore-desc').textContent = 'Inserisci le tue 12 parole nell\'ordine corretto.';
  renderRestoreInputs();
  showScreen('screen-seed-restore');
};

App.forgotPin = function() {
  document.getElementById('restore-title').textContent = 'Sblocca con Seed Phrase';
  document.getElementById('restore-desc').textContent = 'Inserisci le 12 parole per resettare il PIN.';
  state.afterRestorePin = true;
  renderRestoreInputs();
  showScreen('screen-seed-restore');
};

App.restoreWallet = async function() {
  const words = [...document.querySelectorAll('.restore-word')]
    .map(i => i.value.trim().toLowerCase()).filter(w => w);
  if (words.length !== 12) {
    showError('restore-error', 'Inserisci tutte e 12 le parole della Seed Phrase.');
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
    showError('restore-error', 'Seed Phrase non valida. Controlla le parole.');
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
    if (daysUntil(v.unlockDate) <= 0 && !notified[v.id]) {
      new Notification('\uD83D\uDD13 ' + v.icon + ' ' + v.name + ' sbloccato!', {
        body: 'Il tuo salvadanaio \u00e8 pronto. Puoi finalmente prelevare.',
        icon: '/icon-192.png', tag: 'vault-' + v.id
      });
      notified[v.id] = true;
      changed = true;
    }
  });
  if (changed) localStorage.setItem('caveau_notified', JSON.stringify(notified));
}

App.openOnramp = function() {
  document.getElementById('onramp-address').textContent = state.address || '—';
  document.getElementById('onramp-copied').classList.add('hidden');
  App.openModal('modal-onramp');
};

App.copyOnrampAddress = function() {
  navigator.clipboard.writeText(state.address || '');
  document.getElementById('onramp-copied').classList.remove('hidden');
  setTimeout(() => document.getElementById('onramp-copied').classList.add('hidden'), 2000);
};

App.openTransak = function() {
  const url = new URL('https://global.transak.com/');
  url.searchParams.set('defaultCryptoCurrency', 'USDC');
  url.searchParams.set('network', 'polygon');
  url.searchParams.set('colorMode', 'DARK');
  if (state.address) url.searchParams.set('walletAddress', state.address);
  window.open(url.toString(), '_blank');
};

App.openGuardarian = function() {
  const url = new URL('https://guardarian.com/buy-crypto');
  url.searchParams.set('to_currency', 'USDC_MATIC');
  url.searchParams.set('from_currency', 'EUR');
  if (state.address) url.searchParams.set('to_wallet_address', state.address);
  window.open(url.toString(), '_blank');
};

App.openMoonpay = function() {
  const url = new URL('https://buy.moonpay.com/');
  url.searchParams.set('defaultCurrencyCode', 'usdc_polygon');
  if (state.address) url.searchParams.set('walletAddress', state.address);
  window.open(url.toString(), '_blank');
};

function renderDashboard() {
  const vaults = state.vaults;
  const total = vaults.reduce((s, v) => s + vaultTotal(v), 0);
  document.getElementById('stat-total').textContent = total.toFixed(2);
  document.getElementById('stat-vaults').textContent = vaults.length;

  const sorted = [...vaults].sort((a,b) => new Date(a.unlockDate)-new Date(b.unlockDate));
  if (sorted.length) {
    const next = sorted[0];
    const d = daysUntil(next.unlockDate);
    document.getElementById('stat-next-unlock').textContent = next.icon + ' ' + next.name;
    document.getElementById('stat-days-left').textContent = d > 0 ? `${d} giorni` : '🔓 Sbloccato';
  } else {
    document.getElementById('stat-next-unlock').textContent = '—';
    document.getElementById('stat-days-left').textContent = 'nessun vincolo';
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
    const pct = Math.min((total / vault.target) * 100, 100);
    const d = daysUntil(vault.unlockDate);
    const unlocked = d <= 0;
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
              ${unlocked ? '🔓 Sbloccato!' : `🔒 ${d}g al blocco`}
            </span>
          </div>
        </div>
        <span class="text-xs text-slate-500 font-mono">${vault.currency}</span>
      </div>
      <div class="mb-3">
        <div class="flex justify-between text-xs mb-1.5">
          <span class="text-slate-300 font-medium">${total.toFixed(2)}</span>
          <span class="text-slate-400">${vault.target}</span>
        </div>
        <div class="w-full bg-slate-700 rounded-full h-2">
          <div class="h-2 rounded-full" style="width:${pct}%;background:${vault.color}"></div>
        </div>
      </div>
      <div class="flex justify-between text-xs text-slate-500">
        <span>${pct.toFixed(1)}% completato</span>
        <span>${fmtDate(vault.unlockDate)}</span>
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
  const target = parseFloat(document.getElementById('vault-target').value);
  const currency = document.getElementById('vault-currency').value;
  const unlockDate = document.getElementById('vault-date').value;
  if (!name) return showError('vault-error','Inserisci un nome.');
  if (!target || target <= 0) return showError('vault-error','Inserisci un obiettivo valido.');
  if (!unlockDate) return showError('vault-error','Seleziona una data di sblocco.');
  if (new Date(unlockDate) <= new Date()) return showError('vault-error','La data deve essere nel futuro.');
  const vault = {
    id: uid(), name,
    icon: state.selectedPreset.icon,
    color: state.selectedPreset.color,
    target, currency, unlockDate,
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
  const pct = Math.min((total / vault.target) * 100, 100);
  const d = daysUntil(vault.unlockDate);
  document.getElementById('detail-title').textContent = vault.icon + ' ' + vault.name;
  document.getElementById('detail-amount').textContent = `${total.toFixed(2)} ${vault.currency}`;
  document.getElementById('detail-target').textContent = `${vault.target} ${vault.currency}`;
  document.getElementById('detail-pct').textContent = `${pct.toFixed(1)}%`;
  const bar = document.getElementById('detail-progress-bar');
  bar.style.width = `${pct}%`; bar.style.background = vault.color;
  if (d > 0) {
    const mo = Math.floor(d/30), dd = d%30;
    document.getElementById('detail-countdown').textContent = mo > 0 ? `${mo} mesi e ${dd}g` : `${d} giorni`;
    document.getElementById('detail-countdown').style.color = '#f1f5f9';
  } else {
    document.getElementById('detail-countdown').textContent = '🔓 SBLOCCATO';
    document.getElementById('detail-countdown').style.color = '#4ade80';
  }
  document.getElementById('detail-unlock-date').textContent = `Sblocco: ${fmtDate(vault.unlockDate)}`;
  document.getElementById('panic-date').textContent = `Torna il ${fmtDate(vault.unlockDate)}.`;
  renderTxList(vault);
  renderVaultChart(vault);
}

function renderTxList(vault) {
  const el = document.getElementById('detail-transactions');
  if (!vault.transactions.length) {
    el.innerHTML = '<p class="text-slate-500 text-sm text-center py-3">Nessun versamento ancora</p>';
    return;
  }
  el.innerHTML = [...vault.transactions].reverse().map(tx => {
    const hashShort = tx.txHash.slice(0,10) + '\u2026' + tx.txHash.slice(-6);
    const badge     = tx.onChain
      ? `<a href="https://polygonscan.com/tx/${tx.txHash}" target="_blank" class="text-xs font-mono text-blue-400 hover:text-blue-300 underline mt-0.5 block">${hashShort} \u2197</a>`
      : `<p class="text-xs text-slate-600 font-mono mt-0.5">${hashShort} <span class="text-slate-700">(locale)</span></p>`;
    return `
    <div class="bg-slate-800 rounded-xl px-4 py-3 flex justify-between items-center">
      <div>
        <p class="text-sm font-semibold">${tx.onChain ? '\uD83D\uDD12' : '\uD83D\uDCDD'} +${tx.amount} ${vault.currency}</p>
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
  const end   = new Date(vault.unlockDate);
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
  if (!confirm('SEI SICURO? Tutti i dati del Caveau saranno rimossi da questo dispositivo. Assicurati di avere la Seed Phrase!')) return;
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

// ─── Blockchain / Sablier ────────────────────────────────────
async function getTokenBalance(address, currency) {
  const tokenAddr = TOKEN_ADDRESSES[currency];
  if (!tokenAddr) return null;
  try {
    const provider = state.walletSigner?.provider || new ethers.JsonRpcProvider(POLYGON_RPC);
    const contract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
    const raw = await contract.balanceOf(address);
    return Number(ethers.formatUnits(raw, TOKEN_DECIMALS[currency] || 6));
  } catch { return null; }
}

App.showSablierLock = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  const amount = parseFloat(document.getElementById('deposit-amount').value);
  if (!amount || amount <= 0) { showError('deposit-error', 'Inserisci un importo valido.'); return; }
  state.currentLockAmount = amount;

  document.getElementById('lock-vault-name').textContent = vault.icon + ' ' + vault.name;
  document.getElementById('lock-amount').textContent    = amount + ' ' + vault.currency;
  document.getElementById('lock-date').textContent      = fmtDate(vault.unlockDate);
  document.getElementById('lock-address').textContent   = state.address.slice(0,8) + '…' + state.address.slice(-6);
  document.getElementById('lock-balance').textContent   = 'Caricamento...';
  document.getElementById('lock-balance').className     = 'text-slate-400 text-sm';
  document.getElementById('lock-status').textContent    = '';
  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = false; btn.textContent = '🔒 Esegui Blocco';

  App.closeModal('modal-vault-detail');
  App.openModal('modal-sablier-lock');

  const bal = await getTokenBalance(state.address, vault.currency);
  const balEl = document.getElementById('lock-balance');
  if (bal !== null) {
    balEl.textContent = `Disponibile: ${bal.toFixed(2)} ${vault.currency}`;
    balEl.className   = bal >= amount ? 'text-green-400 text-sm' : 'text-red-400 text-sm';
  } else {
    balEl.textContent = 'Saldo non disponibile (controlla connessione)';
  }
};

App.executeSablierLock = async function() {
  const vault = state.vaults.find(v => v.id === state.currentVaultId);
  if (!vault) return;
  if (!state.walletSigner) {
    showLockStatus('error', '❌ Wallet non connesso. Sblocca di nuovo l\'app.');
    return;
  }
  const amount      = state.currentLockAmount;
  const tokenAddr   = TOKEN_ADDRESSES[vault.currency];
  if (!tokenAddr) { showLockStatus('error', '❌ Token non supportato su Polygon.'); return; }
  const decimals    = TOKEN_DECIMALS[vault.currency] || 6;
  const amountUnits = ethers.parseUnits(amount.toString(), decimals);
  const endTs       = Math.floor(new Date(vault.unlockDate + 'T00:00:00').getTime() / 1000);
  const nowTs       = Math.floor(Date.now() / 1000);

  const btn = document.getElementById('lock-execute-btn');
  btn.disabled = true;

  try {
    showLockStatus('pending', '1/2 — Approvazione USDC...');
    const token    = new ethers.Contract(tokenAddr, ERC20_ABI, state.walletSigner);
    const approveTx = await token.approve(SABLIER_LOCKUP, amountUnits);
    showLockStatus('pending', '1/2 — Attendi conferma approvazione...');
    await approveTx.wait();

    showLockStatus('pending', '2/2 — Creazione stream Sablier...');
    const sablier = new ethers.Contract(SABLIER_LOCKUP, SABLIER_ABI, state.walletSigner);
    const params  = {
      sender: state.address, recipient: state.address,
      totalAmount: amountUnits, asset: tokenAddr,
      cancelable: false, transferable: true,
      timestamps: { start: nowTs, end: endTs },
      broker: { account: ethers.ZeroAddress, fee: 0n }
    };
    const tranches = [{ amount: amountUnits, timestamp: endTs }];
    const lockTx   = await sablier.createWithTimestampsLT(params, tranches);
    showLockStatus('pending', '2/2 — Attendi conferma blocco...');
    const receipt  = await lockTx.wait();

    vault.transactions.push({
      id: uid(), date: new Date().toISOString(), amount,
      txHash: receipt.hash, onChain: true
    });
    await saveVaults();
    document.getElementById('deposit-amount').value = '';
    showLockStatus('success', `✅ Bloccato! TX: ${receipt.hash.slice(0,10)}…`);
    btn.textContent = '✅ Bloccato!';
    setTimeout(() => { App.closeModal('modal-sablier-lock'); renderVaultDetail(vault); renderDashboard(); App.openModal('modal-vault-detail'); }, 2500);
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

// ─── Helpers ─────────────────────────────────────────────────
function vaultTotal(vault) {
  return vault.transactions.reduce((s,t) => s+t.amount, 0);
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

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
