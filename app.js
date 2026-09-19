/**
 * Estação da Qualidade do Ar - Arduino Mega + Adafruit IO
 * Usuário Adafruit IO: reisharysson99
 */

const ADAFRUIT_IO_USER = 'reisharysson99';
const FEEDS_API_URL = `https://io.adafruit.com/api/v2/${ADAFRUIT_IO_USER}/feeds`;
const REFRESH_INTERVAL_MS = 15000; // 15 segundos

// Configurações dos Feeds para os Gráficos
const FEED_CONFIGS = {
  pm25: {
    title: 'Material Particulado PM 2.5',
    sensor: 'DSM501A',
    unit: 'µg/m³',
    color: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.25)'
  },
  mq135: {
    title: 'Gases Nocivos (MQ-135)',
    sensor: 'MQ-135',
    unit: 'PPM',
    color: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.25)'
  },
  temperatura: {
    title: 'Temperatura Ambiente',
    sensor: 'DHT11',
    unit: '°C',
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.25)'
  },
  umidade: {
    title: 'Umidade Relativa do Ar',
    sensor: 'DHT11',
    unit: '%',
    color: '#A855F7',
    glowColor: 'rgba(168, 85, 247, 0.25)'
  }
};

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
  },
  // Estado do Modal de Gráfico
  chartModal: {
    activeFeedKey: null,
    currentPeriod: '24h',
    chartInstance: null
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

  // Modal de Gráfico Histórico
  chartModal: document.getElementById('chartModal'),
  chartModalTitle: document.getElementById('chartModalTitle'),
  chartModalSubtitle: document.getElementById('chartModalSubtitle'),
  closeChartModalBtn: document.getElementById('closeChartModalBtn'),
  closeChartXBtn: document.getElementById('closeChartXBtn'),
  chartLoading: document.getElementById('chartLoading'),
  detailChartCanvas: document.getElementById('detailChart'),
  startDateInput: document.getElementById('startDate'),
  endDateInput: document.getElementById('endDate'),
  applyCustomDateBtn: document.getElementById('applyCustomDateBtn'),
  quickFilterBtns: document.querySelectorAll('.quick-filters-group .filter-btn'),

  // Elementos de Estatística do Modal
  statLatest: document.getElementById('statLatest'),
  statMin: document.getElementById('statMin'),
  statMax: document.getElementById('statMax'),
  statAvg: document.getElementById('statAvg'),

  // Modal QR Code Geral
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

  if (state.chartModal.activeFeedKey) {
    fetchAndRenderChartData(state.chartModal.activeFeedKey, state.chartModal.currentPeriod);
  }
}

/* ==========================================================================
   2. Consumo da API REST do Adafruit IO (Leituras em Tempo Real)
   ========================================================================== */
async function fetchAdafruitFeeds() {
  if (state.isFetching) return;
  state.isFetching = true;

  const refreshIcon = DOM.manualRefreshBtn.querySelector('.refresh-icon');
  if (refreshIcon) refreshIcon.classList.add('spinning');

  try {
    const response = await fetch(FEEDS_API_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const feeds = await response.json();
    parseFeedsData(feeds);
    
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

  DOM.heroCard.classList.remove('status-loading', 'status-boa', 'status-normal', 'status-ruim');
  DOM.heroCard.classList.add(`status-${statusKey}`);

  DOM.heroBadgeText.textContent = labelText.toUpperCase();
  DOM.qualidadeValue.textContent = labelText;
  DOM.qualidadeRecommendation.textContent = recommendation;
  DOM.heroIcon.innerHTML = STATUS_ICONS[statusKey];
}

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

function renderMetricMq135() {
  const val = state.data.mq135;
  if (val === null || isNaN(val)) {
    DOM.valMq135.textContent = '--';
    return;
  }

  DOM.valMq135.textContent = Math.round(val);
  let status = 'good';
  let label = 'Satisfatório (<800)';
  let pct = Math.min(100, Math.max(5, (val / 1500) * 100));

  if (val > 1200) {
    status = 'bad';
    label = 'Poluição Elevada';
  } else if (val >= 800) {
    status = 'normal';
    label = 'Moderado';
  }

  updatePillAndBar(DOM.pillMq135, DOM.textMq135, DOM.barMq135, status, label, pct);
}

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
   5. Modal de Gráfico Histórico (com Conversão de Fuso Horário Local Rigorosa)
   ========================================================================== */

/**
 * Funções auxiliares para converter strings de input YYYY-MM-DD em objetos Date no fuso horário local do usuário
 */
function getLocalStartIso(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  // Meia-noite local (00:00:00)
  const localDate = new Date(y, m, d, 0, 0, 0, 0);
  return localDate.toISOString();
}

function getLocalEndIso(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  // Fim do dia local (23:59:59)
  const localDate = new Date(y, m, d, 23, 59, 59, 999);
  return localDate.toISOString();
}

function initChartModalEvents() {
  const metricCards = document.querySelectorAll('.clickable-card');
  metricCards.forEach(card => {
    card.addEventListener('click', () => {
      const feedKey = card.getAttribute('data-feed');
      if (feedKey) openChartModal(feedKey);
    });
  });

  DOM.closeChartModalBtn.addEventListener('click', closeChartModal);
  DOM.closeChartXBtn.addEventListener('click', closeChartModal);
  DOM.chartModal.addEventListener('click', (e) => {
    if (e.target === DOM.chartModal) closeChartModal();
  });

  // Filtros de período rápido (24h, 7d, all)
  DOM.quickFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.quickFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const period = btn.getAttribute('data-period');
      state.chartModal.currentPeriod = period;
      
      DOM.startDateInput.value = '';
      DOM.endDateInput.value = '';

      fetchAndRenderChartData(state.chartModal.activeFeedKey, period);
    });
  });

  // Filtro de data personalizada
  DOM.applyCustomDateBtn.addEventListener('click', () => {
    const startStr = DOM.startDateInput.value;
    const endStr = DOM.endDateInput.value;

    if (!startStr && !endStr) {
      alert('Por favor, selecione a Data Inicial ou Data Final para filtrar.');
      return;
    }

    DOM.quickFilterBtns.forEach(b => b.classList.remove('active'));
    state.chartModal.currentPeriod = 'custom';
    fetchAndRenderChartData(state.chartModal.activeFeedKey, 'custom', startStr, endStr);
  });
}

function openChartModal(feedKey) {
  const config = FEED_CONFIGS[feedKey];
  if (!config) return;

  state.chartModal.activeFeedKey = feedKey;
  state.chartModal.currentPeriod = '24h';

  DOM.quickFilterBtns.forEach(b => {
    if (b.getAttribute('data-period') === '24h') b.classList.add('active');
    else b.classList.remove('active');
  });
  DOM.startDateInput.value = '';
  DOM.endDateInput.value = '';

  DOM.chartModalTitle.textContent = config.title;
  DOM.chartModalSubtitle.textContent = `Sensor: ${config.sensor} • Feed: ${feedKey}`;

  DOM.chartModal.classList.add('active');
  DOM.chartModal.setAttribute('aria-hidden', 'false');

  fetchAndRenderChartData(feedKey, '24h');
}

function closeChartModal() {
  DOM.chartModal.classList.remove('active');
  DOM.chartModal.setAttribute('aria-hidden', 'true');
  state.chartModal.activeFeedKey = null;

  if (state.chartModal.chartInstance) {
    state.chartModal.chartInstance.destroy();
    state.chartModal.chartInstance = null;
  }
}

/**
 * Consulta oficial com fuso horário local ajustado para start_time e end_time
 */
async function fetchAndRenderChartData(feedKey, period, customStartStr = '', customEndStr = '') {
  if (!feedKey) return;

  DOM.chartLoading.classList.add('active');

  let url = `https://io.adafruit.com/api/v2/${ADAFRUIT_IO_USER}/feeds/${feedKey}/data/chart`;
  const params = [];

  let localStartObj = null;
  let localEndObj = null;

  if (period === '24h') {
    params.push('hours=24');
    params.push('resolution=10');
  } else if (period === '7d') {
    params.push('hours=168');
    params.push('resolution=60');
  } else if (period === 'all') {
    params.push('hours=2160'); // 90 dias
    params.push('resolution=120');
  } else if (period === 'custom') {
    if (customStartStr) {
      const parts = customStartStr.split('-');
      localStartObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0, 0);
      params.push(`start_time=${encodeURIComponent(localStartObj.toISOString())}`);
    }
    if (customEndStr) {
      const parts = customEndStr.split('-');
      localEndObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59, 999);
      params.push(`end_time=${encodeURIComponent(localEndObj.toISOString())}`);
    }
    params.push('resolution=15');
  }

  if (params.length > 0) {
    url += '?' + params.join('&');
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const chartJson = await response.json();
    let parsedData = [];

    if (chartJson && Array.isArray(chartJson.data)) {
      parsedData = chartJson.data.map(row => ({
        date: new Date(row[0]),
        value: parseFloat(row[1])
      })).filter(d => !isNaN(d.value)).sort((a, b) => a.date - b.date);
    }

    // Filtro adicional rigoroso em memória para garantir limites de data local
    if (period === 'custom') {
      if (localStartObj) parsedData = parsedData.filter(d => d.date >= localStartObj);
      if (localEndObj) parsedData = parsedData.filter(d => d.date <= localEndObj);
    }

    // Se o endpoint /data/chart não retornar dados para datas específicas, tenta o fallback
    if (parsedData.length === 0 && period === 'custom') {
      parsedData = await fetchRawDataFallback(feedKey, localStartObj, localEndObj);
    }

    renderChartAndStats(feedKey, parsedData, period, customStartStr, customEndStr);

  } catch (error) {
    console.error('Erro ao buscar histórico Adafruit IO /data/chart:', error);
  } finally {
    DOM.chartLoading.classList.remove('active');
  }
}

async function fetchRawDataFallback(feedKey, localStartObj, localEndObj) {
  let fallbackUrl = `https://io.adafruit.com/api/v2/${ADAFRUIT_IO_USER}/feeds/${feedKey}/data?limit=1000`;

  if (localStartObj) {
    fallbackUrl += `&start_time=${encodeURIComponent(localStartObj.toISOString())}`;
  }
  if (localEndObj) {
    fallbackUrl += `&end_time=${encodeURIComponent(localEndObj.toISOString())}`;
  }

  try {
    const res = await fetch(fallbackUrl, { cache: 'no-store' });
    if (!res.ok) return [];
    const arr = await res.json();
    let items = arr.map(item => ({
      date: new Date(item.created_at),
      value: parseFloat(item.value)
    })).filter(d => !isNaN(d.value)).sort((a, b) => a.date - b.date);

    if (localStartObj) items = items.filter(d => d.date >= localStartObj);
    if (localEndObj) items = items.filter(d => d.date <= localEndObj);
    return items;
  } catch (e) {
    return [];
  }
}

function formatDatePtBr(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function renderChartAndStats(feedKey, dataArr, period, startStr, endStr) {
  const config = FEED_CONFIGS[feedKey];
  if (!config) return;

  calculateAndRenderStats(dataArr, config.unit);

  let periodLabel = 'Últimas 24h';
  if (period === '7d') periodLabel = 'Últimos 7 Dias';
  else if (period === 'all') periodLabel = 'Todo o Histórico (Completo)';
  else if (period === 'custom') {
    const ptStart = formatDatePtBr(startStr);
    const ptEnd = formatDatePtBr(endStr);
    periodLabel = `Período: ${ptStart || 'Início'} (00:00) até ${ptEnd || 'Hoje'} (23:59)`;
  }

  DOM.chartModalSubtitle.textContent = `Sensor: ${config.sensor} • ${periodLabel} (${dataArr.length} pontos)`;

  // Formatação dos Rótulos do Eixo X
  const isMultiDay = period === '7d' || period === 'all' || (dataArr.length > 0 && (dataArr[dataArr.length - 1].date - dataArr[0].date > 20 * 60 * 60 * 1000));

  const labels = dataArr.map(d => {
    const h = String(d.date.getHours()).padStart(2, '0');
    const m = String(d.date.getMinutes()).padStart(2, '0');
    const day = String(d.date.getDate()).padStart(2, '0');
    const month = String(d.date.getMonth() + 1).padStart(2, '0');

    return isMultiDay ? `${day}/${month} ${h}:${m}` : `${h}:${m}`;
  });

  const datasetValues = dataArr.map(d => d.value);

  if (state.chartModal.chartInstance) {
    state.chartModal.chartInstance.destroy();
  }

  const isLight = DOM.html.getAttribute('data-theme') === 'light';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.07)';
  const textColor = isLight ? '#0F172A' : '#F8FAFC';

  const ctx = DOM.detailChartCanvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 0, 440);
  gradient.addColorStop(0, config.glowColor);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  state.chartModal.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${config.title} (${config.unit})`,
        data: datasetValues,
        borderColor: config.color,
        borderWidth: 3,
        pointBackgroundColor: config.color,
        pointRadius: datasetValues.length > 80 ? 0 : 3,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: gradient,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: textColor,
            font: { family: 'Outfit', size: 14, weight: '700' }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title: function(context) {
              const idx = context[0].dataIndex;
              const item = dataArr[idx];
              if (item) {
                const day = String(item.date.getDate()).padStart(2, '0');
                const month = String(item.date.getMonth() + 1).padStart(2, '0');
                const year = item.date.getFullYear();
                const h = String(item.date.getHours()).padStart(2, '0');
                const m = String(item.date.getMinutes()).padStart(2, '0');
                return `Data: ${day}/${month}/${year} às ${h}:${m}`;
              }
              return context[0].label;
            },
            label: function(context) {
              return ` Valor: ${context.parsed.y} ${config.unit}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Outfit', size: 11, weight: '600' },
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: isMultiDay ? 8 : 10
          }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'JetBrains Mono', size: 12, weight: '700' }
          }
        }
      }
    }
  });
}

function calculateAndRenderStats(dataArr, unit) {
  if (!dataArr || dataArr.length === 0) {
    DOM.statLatest.textContent = '--';
    DOM.statMin.textContent = '--';
    DOM.statMax.textContent = '--';
    DOM.statAvg.textContent = '--';
    return;
  }

  const values = dataArr.map(d => d.value);
  const latest = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / values.length;

  DOM.statLatest.textContent = `${latest.toFixed(1)} ${unit}`;
  DOM.statMin.textContent = `${min.toFixed(1)} ${unit}`;
  DOM.statMax.textContent = `${max.toFixed(1)} ${unit}`;
  DOM.statAvg.textContent = `${avg.toFixed(1)} ${unit}`;
}

/* ==========================================================================
   6. Modal de QR Code Geral
   ========================================================================== */
function initQrModal() {
  const currentUrl = window.location.href;
  DOM.qrUrlText.textContent = currentUrl;
  
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
   7. Inicialização da Aplicação
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initQrModal();
  initChartModalEvents();

  DOM.manualRefreshBtn.addEventListener('click', () => {
    fetchAdafruitFeeds();
  });

  // Primeira chamada imediata ao carregar
  fetchAdafruitFeeds();
  startRefreshCycle();
});
