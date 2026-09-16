/**
 * Estação de Monitoramento da Qualidade do Ar - Arduino Mega + Adafruit IO
 * Usuário Adafruit IO: reisharysson99
 */

const ADAFRUIT_IO_USER = 'reisharysson99';
const FEEDS_API_URL = `https://io.adafruit.com/api/v2/${ADAFRUIT_IO_USER}/feeds`;
const REFRESH_INTERVAL_MS = 15000; // 15 segundos

// Estado da Aplicação
const state = {
  theme: localStorage.getItem('ecoair_theme') || 'dark',
  lastUpdated: null,
  timerCountdown: REFRESH_INTERVAL_MS,
  timerInterval: null,
  progressInterval: null,
  isFetching: false,
  data: {
    qualidade: null,
    temperatura: null,
    umidade: null,
    mq135: null,
    pm25: null
  }
};

// Elementos do DOM
const DOM = {
  html: document.documentElement,
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  manualRefreshBtn: document.getElementById('manualRefreshBtn'),
  connectivityBadge: document.getElementById('connectivityBadge'),
  connectivityText: document.getElementById('connectivityText'),
  lastUpdatedText: document.getElementById('lastUpdatedText'),
  refreshProgress: document.getElementById('refreshProgress'),
  ambientGlow: document.getElementById('ambientGlow'),

  // Hero Card Elements
  heroCard: document.getElementById('heroCard'),
  heroBadge: document.getElementById('heroBadge'),
  heroBadgeText: document.getElementById('heroBadgeText'),
  heroIcon: document.getElementById('heroIcon'),
  qualidadeValue: document.getElementById('qualidadeValue'),
  qualidadeRecommendation: document.getElementById('qualidadeRecommendation'),

  // Metric Cards Elements
  valPm25: document.getElementById('valPm25'),
  pillPm25: document.getElementById('pillPm25'),
  textPm25: document.getElementById('textPm25'),
  barPm25: document.getElementById('barPm25'),

  valMq135: document.getElementById('valMq135'),
  pillMq135: document.getElementById('pillMq135'),
  textMq135: document.getElementById('textMq135'),
  barMq135: document.getElementById('barMq135'),

  valTemp: document.getElementById('valTemp'),
  pillTemp: document.getElementById('pillTemp'),
  textTemp: document.getElementById('textTemp'),
  barTemp: document.getElementById('barTemp'),

  valHumidity: document.getElementById('valHumidity'),
  pillHumidity: document.getElementById('pillHumidity'),
  textHumidity: document.getElementById('textHumidity'),
  barHumidity: document.getElementById('barHumidity'),

  // Modal QR Code
  openQrModalBtn: document.getElementById('openQrModalBtn'),
  closeQrModalBtn: document.getElementById('closeQrModalBtn'),
  qrModal: document.getElementById('qrModal'),
  qrImage: document.getElementById('qrImage'),
  qrUrlText: document.getElementById('qrUrlText'),
  copyUrlBtn: document.getElementById('copyUrlBtn')
};

// SVG Icons para Status da Qualidade do Ar
const STATUS_ICONS = {
  boa: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 11 12 14 22 4"/></svg>`,
  normal: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  ruim: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
};

/* ==========================================================================
   1. Gerenciamento de Tema (Dark / Light Mode)
   ========================================================================== */
function initTheme() {
  DOM.html.setAttribute('data-theme', state.theme);
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  DOM.html.setAttribute('data-theme', state.theme);
  localStorage.setItem('ecoair_theme', state.theme);
}

/* ==========================================================================
   2. Consumo da API REST do Adafruit IO
   ========================================================================== */
async function fetchAdafruitFeeds() {
  if (state.isFetching) return;
  state.isFetching = true;

  // Animação no botão de refresh
  const refreshIcon = DOM.manualRefreshBtn.querySelector('.refresh-icon');
  if (refreshIcon) refreshIcon.classList.add('spinning');

  try {
    const response = await fetch(FEEDS_API_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const feeds = await response.json();
    parseFeedsData(feeds);
    
    // Atualiza status da conexão
    setConnectivityStatus(true);
    state.lastUpdated = new Date();
    updateTimestampUI();
    resetProgressTimer();

  } catch (error) {
    console.error('Erro ao consultar Adafruit IO:', error);
    setConnectivityStatus(false);
  } finally {
    state.isFetching = false;
    if (refreshIcon) refreshIcon.classList.remove('spinning');
  }
}

function parseFeedsData(feeds) {
  if (!Array.isArray(feeds)) return;

  feeds.forEach(feed => {
    const key = feed.key ? feed.key.toLowerCase() : '';
    const lastVal = feed.last_value;

    if (key === 'temperatura') state.data.temperatura = parseFloat(lastVal);
    else if (key === 'umidade') state.data.umidade = parseFloat(lastVal);
    else if (key === 'mq135') state.data.mq135 = parseFloat(lastVal);
    else if (key === 'pm25') state.data.pm25 = parseFloat(lastVal);
    else if (key === 'qualidade') state.data.qualidade = lastVal;
  });

  renderUI();
}

/* ==========================================================================
   3. Renderização & Atualização Dinâmica do DOM
   ========================================================================== */
function renderUI() {
  renderHeroCard();
  renderMetricPm25();
  renderMetricMq135();
  renderMetricTemp();
  renderMetricHumidity();
}

/**
 * Hero Card: Qualidade Geral do Ar
 */
function renderHeroCard() {
  const rawQualidade = state.data.qualidade;
  let statusKey = 'normal';
  let labelText = 'Normal';
  let recommendation = 'Qualidade do ar aceitável. Monitoramento ativo.';

  if (rawQualidade) {
    const normStr = String(rawQualidade).trim().toLowerCase();
    if (normStr.includes('boa') || normStr.includes('bom') || normStr.includes('good')) {
      statusKey = 'boa';
      labelText = 'Boa';
      recommendation = 'Qualidade do ar excelente! Ótimo para atividades ao ar livre.';
    } else if (normStr.includes('ruim') || normStr.includes('bad') || normStr.includes('pessima')) {
      statusKey = 'ruim';
      labelText = 'Ruim';
      recommendation = 'Atenção! Níveis de poluição elevados. Evite exposição prolongada.';
    } else {
      statusKey = 'normal';
      labelText = 'Normal';
      recommendation = 'Qualidade do ar moderada. Condições aceitáveis para a população geral.';
    }
  }

  // Remove classes anteriores
  DOM.heroCard.classList.remove('status-loading', 'status-boa', 'status-normal', 'status-ruim');
  DOM.heroCard.classList.add(`status-${statusKey}`);

  DOM.heroBadgeText.textContent = labelText.toUpperCase();
  DOM.qualidadeValue.textContent = labelText;
  DOM.qualidadeRecommendation.textContent = recommendation;
  DOM.heroIcon.innerHTML = STATUS_ICONS[statusKey];
}

/**
 * Cartão 1: PM 2.5 (Particulados em µg/m³)
 * Limiares OMS: Boa <= 12, Normal 12.1-35.4, Ruim > 35.4
 */
function renderMetricPm25() {
  const val = state.data.pm25;
  if (val === null || isNaN(val)) {
    DOM.valPm25.textContent = '--';
    return;
  }

  DOM.valPm25.textContent = val.toFixed(1);
  let status = 'good';
  let label = 'Ar Limpo';
  let pct = Math.min(100, Math.max(5, (val / 50) * 100));

  if (val > 35.4) {
    status = 'bad';
    label = 'Insalubre';
  } else if (val > 12.0) {
    status = 'normal';
    label = 'Moderado';
  }

  updatePillAndBar(DOM.pillPm25, DOM.textPm25, DOM.barPm25, status, label, pct);
}

/**
 * Cartão 2: MQ-135 (Gases Nocivos em ADC)
 * Limiares: Boa < 300, Normal 300-700, Ruim > 700
 */
function renderMetricMq135() {
  const val = state.data.mq135;
  if (val === null || isNaN(val)) {
    DOM.valMq135.textContent = '--';
    return;
  }

  DOM.valMq135.textContent = Math.round(val);
  let status = 'good';
  let label = 'Sem Poluição';
  let pct = Math.min(100, Math.max(5, (val / 1024) * 100));

  if (val > 700) {
    status = 'bad';
    label = 'Gás Elevado';
  } else if (val >= 300) {
    status = 'normal';
    label = 'Atenção';
  }

  updatePillAndBar(DOM.pillMq135, DOM.textMq135, DOM.barMq135, status, label, pct);
}

/**
 * Cartão 3: Temperatura (°C)
 * Limiares Conforto: Boa 20-26°C, Normal 15-19.9 / 26.1-32°C, Ruim <15 ou >32°C
 */
function renderMetricTemp() {
  const val = state.data.temperatura;
  if (val === null || isNaN(val)) {
    DOM.valTemp.textContent = '--';
    return;
  }

  DOM.valTemp.textContent = val.toFixed(1);
  let status = 'good';
  let label = 'Confortável';
  let pct = Math.min(100, Math.max(5, (val / 45) * 100));

  if (val < 15 || val > 32) {
    status = 'bad';
    label = val < 15 ? 'Muito Frio' : 'Muito Quente';
  } else if (val < 20 || val > 26) {
    status = 'normal';
    label = val < 20 ? 'Fresco' : 'Aqueceu';
  }

  updatePillAndBar(DOM.pillTemp, DOM.textTemp, DOM.barTemp, status, label, pct);
}

/**
 * Cartão 4: Umidade Relativa (%)
 * Limiares Conforto: Boa 40-60%, Normal 30-39% / 61-70%, Ruim <30% ou >70%
 */
function renderMetricHumidity() {
  const val = state.data.umidade;
  if (val === null || isNaN(val)) {
    DOM.valHumidity.textContent = '--';
    return;
  }

  DOM.valHumidity.textContent = Math.round(val);
  let status = 'good';
  let label = 'Ideal';
  let pct = Math.min(100, Math.max(5, val));

  if (val < 30 || val > 70) {
    status = 'bad';
    label = val < 30 ? 'Ar Seco' : 'Muito Úmido';
  } else if (val < 40 || val > 60) {
    status = 'normal';
    label = val < 40 ? 'Seco Moderado' : 'Úmido';
  }

  updatePillAndBar(DOM.pillHumidity, DOM.textHumidity, DOM.barHumidity, status, label, pct);
}

function updatePillAndBar(pillEl, textEl, barEl, status, label, pct) {
  pillEl.className = `status-pill status-${status}`;
  textEl.textContent = label;
  barEl.className = `metric-bar-fill fill-${status}`;
  barEl.style.width = `${pct}%`;
}

/* ==========================================================================
   4. Status de Conectividade e Timers
   ========================================================================== */
function setConnectivityStatus(isOnline) {
  if (isOnline) {
    DOM.connectivityBadge.style.color = 'var(--status-good)';
    DOM.connectivityBadge.style.borderColor = 'var(--border-card)';
    DOM.connectivityText.textContent = 'ONLINE';
  } else {
    DOM.connectivityBadge.style.color = 'var(--status-bad)';
    DOM.connectivityBadge.style.borderColor = 'var(--status-bad)';
    DOM.connectivityText.textContent = 'ERRO REDE';
  }
}

function updateTimestampUI() {
  if (!state.lastUpdated) return;
  const hours = String(state.lastUpdated.getHours()).padStart(2, '0');
  const minutes = String(state.lastUpdated.getMinutes()).padStart(2, '0');
  const seconds = String(state.lastUpdated.getSeconds()).padStart(2, '0');
  DOM.lastUpdatedText.textContent = `${hours}:${minutes}:${seconds}`;
}

function startRefreshCycle() {
  resetProgressTimer();

  // Consulta regular a cada 15 segundos
  state.timerInterval = setInterval(() => {
    fetchAdafruitFeeds();
  }, REFRESH_INTERVAL_MS);
}

function resetProgressTimer() {
  if (state.progressInterval) clearInterval(state.progressInterval);

  let startTime = Date.now();
  DOM.refreshProgress.style.width = '100%';

  state.progressInterval = setInterval(() => {
    let elapsed = Date.now() - startTime;
    let remaining = Math.max(0, REFRESH_INTERVAL_MS - elapsed);
    let pct = (remaining / REFRESH_INTERVAL_MS) * 100;
    DOM.refreshProgress.style.width = `${pct}%`;

    if (remaining <= 0) {
      clearInterval(state.progressInterval);
    }
  }, 100);
}

/* ==========================================================================
   5. Modal de QR Code
   ========================================================================== */
function initQrModal() {
  const currentUrl = window.location.href;
  DOM.qrUrlText.textContent = currentUrl;
  
  // Utiliza serviço gratuito de API de QR Code para gerar imagem instantânea
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(currentUrl)}&color=090D16&bgcolor=FFFFFF`;
  DOM.qrImage.src = qrApiUrl;

  DOM.openQrModalBtn.addEventListener('click', () => {
    DOM.qrModal.classList.add('active');
    DOM.qrModal.setAttribute('aria-hidden', 'false');
  });

  DOM.closeQrModalBtn.addEventListener('click', () => {
    DOM.qrModal.classList.remove('active');
    DOM.qrModal.setAttribute('aria-hidden', 'true');
  });

  DOM.qrModal.addEventListener('click', (e) => {
    if (e.target === DOM.qrModal) {
      DOM.qrModal.classList.remove('active');
    }
  });

  DOM.copyUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      DOM.copyUrlBtn.textContent = 'Copiado com Sucesso!';
      setTimeout(() => {
        DOM.copyUrlBtn.textContent = 'Copiar Link da Estação';
      }, 2000);
    });
  });
}

/* ==========================================================================
   6. Inicialização da Aplicação
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initQrModal();

  // Event Listeners
  DOM.manualRefreshBtn.addEventListener('click', () => {
    fetchAdafruitFeeds();
  });

  // Primeira chamada imediata ao carregar
  fetchAdafruitFeeds();
  startRefreshCycle();
});
