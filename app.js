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

const DONATION_ADDRESS = '0x742d35Cc6634C0532925a3b844f5E3E7e3901234';

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
App.closeModal = id => document.getElementById(id)?.classList.remove('active');

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
  pinBuffer:      { set: '', unlock: '' },
  pinStage:       'first', // 'first' | 'confirm'
  pinFirst:       '',
  afterRestorePin: false  // true when PIN set comes after restore
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
}

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
  el.innerHTML = [...vault.transactions].reverse().map(tx => `
    <div class="bg-slate-800 rounded-xl px-4 py-3 flex justify-between items-center">
      <div>
        <p class="text-sm font-semibold">🔒 +${tx.amount} ${vault.currency}</p>
        <p class="text-xs text-slate-500 font-mono mt-0.5">${tx.txHash.slice(0,10)}…${tx.txHash.slice(-6)}</p>
      </div>
      <span class="text-xs text-slate-400">${fmtDateShort(tx.date.split('T')[0])}</span>
    </div>`).join('');
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

App.showSeedPhrase = async function() {
  const blob = localStorage.getItem(STORAGE.SEED_ENC);
  const salt = localStorage.getItem(STORAGE.PIN_SALT);
  if (!blob) return;
  // Re-derive mnemonic requires PIN — show a small inline prompt
  const pin = prompt('Inserisci il tuo PIN per vedere la Seed Phrase:');
  if (!pin) return;
  try {
    const pinKey = await deriveKeyFromString(pin, 'caveau-pin-' + salt);
    const mnemonic = await decrypt(pinKey, blob);
    renderSeedWordGrid(mnemonic, 'show-seed-grid');
    closeModal('modal-settings');
    openModal('modal-show-seed');
  } catch {
    alert('PIN errato.');
  }
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
