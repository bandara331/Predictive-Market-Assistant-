/**
 * stock-api.js — Stock Data Fetching & Watchlist Management
 * Handles: Historical OHLCV data, ML predictions, Symbol selection, Demo data fallback
 */

const StockAPI = (() => {
  const BACKEND_URL = 'http://localhost:8080/api/dashboard';
  const ML_URL      = 'http://localhost:8000';

  let currentSymbol   = 'AAPL';
  let currentTimeframe = '1M';
  let cachedData      = {};

  const COMPANY_NAMES = {
    AAPL:  'Apple Inc.',
    GOOGL: 'Alphabet Inc.',
    MSFT:  'Microsoft Corporation',
    TSLA:  'Tesla, Inc.',
    NVDA:  'NVIDIA Corporation',
    AMZN:  'Amazon.com, Inc.'
  };

  const MARKET_CAPS = {
    AAPL:  '$3.42T', GOOGL: '$2.18T', MSFT: '$3.15T',
    TSLA:  '$0.82T', NVDA:  '$3.35T', AMZN: '$2.05T'
  };

  /* ─── Fetch Historical Data ─── */
  async function fetchHistorical(symbol, timeframe = '1M') {
    const cacheKey = `${symbol}_${timeframe}`;
    if (cachedData[cacheKey]) return cachedData[cacheKey];

    try {
      const res = await fetch(
        `${BACKEND_URL}/stocks/${symbol}?timeframe=${timeframe}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      cachedData[cacheKey] = data;
      return data;
    } catch {
      // Fallback: generate realistic demo data
      const data = generateDemoOHLCV(symbol, timeframe);
      cachedData[cacheKey] = data;
      return data;
    }
  }

  /* ─── Fetch LSTM Predictions ─── */
  async function fetchPredictions(symbol) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/predict/${symbol}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('Backend error');
      return await res.json();
    } catch {
      try {
        // Try ML service directly
        const res = await fetch(`${ML_URL}/predict/${symbol}`);
        if (!res.ok) throw new Error('ML error');
        return await res.json();
      } catch {
        return generateDemoPredictions(symbol);
      }
    }
  }

  /* ─── Symbol Selection ─── */
  async function loadSymbol(symbol, timeframe = currentTimeframe) {
    currentSymbol = symbol;
    currentTimeframe = timeframe;

    // Update UI immediately
    document.getElementById('stock-ticker-display').textContent = symbol;
    document.getElementById('stock-company-display').textContent = COMPANY_NAMES[symbol] || symbol;
    document.getElementById('legend-symbol-label').textContent = symbol;
    document.getElementById('current-symbol-mention').textContent = symbol;
    document.getElementById('meta-mktcap').textContent = MARKET_CAPS[symbol] || '—';

    // Show loading
    document.getElementById('chart-loading')?.classList.remove('hidden');

    // Update symbol buttons
    document.querySelectorAll('.symbol-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`sym-${symbol}`)?.classList.add('active');

    try {
      const [historicalData, predictions] = await Promise.all([
        fetchHistorical(symbol, timeframe),
        fetchPredictions(symbol)
      ]);

      renderChart(historicalData, predictions);
      updateMetrics(historicalData, predictions);
    } finally {
      document.getElementById('chart-loading')?.classList.add('hidden');
    }
  }

  /* ─── Chart Rendering ─── */
  function renderChart(historicalData, predictions) {
    const candles = historicalData.ohlcv.map(d => ({
      time:  d.timestamp,
      open:  d.open,
      high:  d.high,
      low:   d.low,
      close: d.close
    }));
    ChartModule.loadCandles(candles);

    if (predictions?.prices?.length) {
      const predLine = predictions.prices.map(p => ({
        time:  p.timestamp,
        value: p.price
      }));
      ChartModule.loadPredictions(predLine);
    }
  }

  /* ─── Metrics Update ─── */
  function updateMetrics(historicalData, predictions) {
    const latest    = historicalData.ohlcv[historicalData.ohlcv.length - 1];
    const previous  = historicalData.ohlcv[historicalData.ohlcv.length - 2];
    const price     = latest.close;
    const prevPrice = previous?.close ?? price;
    const change    = price - prevPrice;
    const changePct = ((change / prevPrice) * 100);
    const isUp      = change >= 0;
    const sign      = isUp ? '+' : '';

    // Header
    document.getElementById('stock-price-display').textContent = `$${price.toFixed(2)}`;
    const badge = document.getElementById('price-badge');
    badge.className = `price-badge ${isUp ? 'up' : 'down'}`;
    document.getElementById('price-change-icon').textContent = isUp ? '▲' : '▼';
    document.getElementById('price-change-value').textContent = `${sign}${changePct.toFixed(2)}%`;
    document.getElementById('price-change-amount').textContent = `(${sign}$${Math.abs(change).toFixed(2)})`;

    // Meta row
    document.getElementById('meta-open').textContent   = `$${latest.open.toFixed(2)}`;
    document.getElementById('meta-high').textContent   = `$${latest.high.toFixed(2)}`;
    document.getElementById('meta-low').textContent    = `$${latest.low.toFixed(2)}`;
    document.getElementById('meta-volume').textContent = formatVolume(latest.volume);

    // KPI Cards
    document.getElementById('kpi-price').textContent        = `$${price.toFixed(2)}`;
    document.getElementById('kpi-price-change').textContent = `${sign}${changePct.toFixed(2)}% today`;
    document.getElementById('kpi-price-change').style.color = isUp ? 'var(--green)' : 'var(--red)';

    // 52-week range
    const closes = historicalData.ohlcv.map(d => d.close);
    const high52  = Math.max(...closes).toFixed(2);
    const low52   = Math.min(...closes).toFixed(2);
    document.getElementById('kpi-52w').textContent     = `$${low52} – $${high52}`;

    // Predicted price
    if (predictions?.prices?.length) {
      const lastPred    = predictions.prices[predictions.prices.length - 1].price;
      const predChange  = ((lastPred - price) / price * 100);
      const predSign    = predChange >= 0 ? '+' : '';
      document.getElementById('kpi-predicted').textContent       = `$${lastPred.toFixed(2)}`;
      document.getElementById('kpi-predicted-change').textContent = `${predSign}${predChange.toFixed(1)}% in 30 days`;
      document.getElementById('kpi-predicted-change').style.color = predChange >= 0 ? 'var(--green)' : 'var(--red)';

      const confidence = predictions.confidence ?? Math.round(72 + Math.random() * 18);
      const signal     = confidence > 75 ? (predChange >= 0 ? '🟢 Strong Buy' : '🔴 Strong Sell')
                       : confidence > 60 ? (predChange >= 0 ? '🔵 Buy' : '🟡 Hold') : '⚪ Neutral';
      document.getElementById('kpi-confidence').textContent = `${confidence}%`;
      document.getElementById('kpi-signal').textContent     = signal;
    }

    // Update watchlist
    updateWatchlistItem(currentSymbol, price, changePct, isUp);
  }

  /* ─── Watchlist ─── */
  async function initWatchlist() {
    const symbols   = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'];
    const container = document.getElementById('watchlist-items');
    if (!container) return;

    // Render skeleton items immediately
    container.innerHTML = symbols.map(sym => `
      <div class="watchlist-item" id="wl-${sym}" onclick="selectSymbol('${sym}')">
        <span class="wl-symbol">${sym}</span>
        <svg class="wl-sparkline" id="spark-${sym}" viewBox="0 0 80 30" preserveAspectRatio="none"></svg>
        <div class="wl-price-block">
          <div class="wl-price" id="wl-price-${sym}">—</div>
          <div class="wl-change" id="wl-chg-${sym}">—</div>
        </div>
      </div>
    `).join('');

    // Populate async with demo data
    for (const sym of symbols) {
      const data   = generateDemoOHLCV(sym, '1M');
      const prices = data.ohlcv.map(d => d.close);
      const last   = prices[prices.length - 1];
      const prev   = prices[prices.length - 2];
      const chg    = ((last - prev) / prev * 100);
      const isUp   = chg >= 0;
      renderSparkline(sym, prices.slice(-20), isUp);
      updateWatchlistItem(sym, last, chg, isUp);
    }
  }

  function updateWatchlistItem(symbol, price, changePct, isUp) {
    const priceEl = document.getElementById(`wl-price-${symbol}`);
    const chgEl   = document.getElementById(`wl-chg-${symbol}`);
    const item    = document.getElementById(`wl-${symbol}`);
    if (priceEl) priceEl.textContent = `$${price.toFixed(2)}`;
    if (chgEl) {
      const sign = isUp ? '+' : '';
      chgEl.textContent = `${sign}${changePct.toFixed(2)}%`;
      chgEl.className   = `wl-change ${isUp ? 'up' : 'down'}`;
    }
    // Active state
    document.querySelectorAll('.watchlist-item').forEach(i => i.classList.remove('active'));
    if (item && symbol === currentSymbol) item.classList.add('active');
  }

  function renderSparkline(symbol, prices, isUp) {
    const svg     = document.getElementById(`spark-${symbol}`);
    if (!svg) return;
    const min     = Math.min(...prices);
    const max     = Math.max(...prices);
    const range   = max - min || 1;
    const w = 80, h = 28;
    const pts     = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const color   = isUp ? '#26a69a' : '#ef5350';
    svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }

  /* ─── Demo Data Generator ─── */
  function generateDemoOHLCV(symbol, timeframe) {
    const SEED_PRICES = { AAPL: 189, GOOGL: 178, MSFT: 420, TSLA: 248, NVDA: 875, AMZN: 195 };
    const VOLATILITY  = { AAPL: 0.012, GOOGL: 0.013, MSFT: 0.011, TSLA: 0.028, NVDA: 0.022, AMZN: 0.015 };
    const TF_DAYS     = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

    const days   = TF_DAYS[timeframe] || 30;
    const vol    = VOLATILITY[symbol] || 0.015;
    let   price  = SEED_PRICES[symbol] || 150;
    const ohlcv  = [];
    const today  = new Date();

    // Walk backwards from today
    const dayMs  = 86400;
    const startTs = Math.floor(today.getTime() / 1000) - days * dayMs;

    for (let i = 0; i <= days; i++) {
      const ts    = startTs + i * dayMs;
      const date  = new Date(ts * 1000);
      if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends

      const change = price * vol * (Math.random() * 2 - 1);
      const open   = price;
      const close  = Math.max(1, price + change);
      const high   = Math.max(open, close) * (1 + Math.random() * vol * 0.5);
      const low    = Math.min(open, close) * (1 - Math.random() * vol * 0.5);
      const volume = Math.round(20000000 + Math.random() * 60000000);

      ohlcv.push({ timestamp: ts, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume });
      price = close;
    }

    return { symbol, timeframe, ohlcv };
  }

  function generateDemoPredictions(symbol) {
    const SEED_PRICES = { AAPL: 189, GOOGL: 178, MSFT: 420, TSLA: 248, NVDA: 875, AMZN: 195 };
    const TRENDS      = { AAPL: 1.003, GOOGL: 1.002, MSFT: 1.004, TSLA: 0.997, NVDA: 1.005, AMZN: 1.003 };

    let price = SEED_PRICES[symbol] || 150;
    const trend = TRENDS[symbol] || 1.002;
    const prices = [];
    const now = Math.floor(Date.now() / 1000);
    const dayMs = 86400;

    for (let i = 1; i <= 30; i++) {
      const ts   = now + i * dayMs;
      const date = new Date(ts * 1000);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const noise = price * 0.008 * (Math.random() * 2 - 1);
      price = price * trend + noise;
      prices.push({ timestamp: ts, price: +price.toFixed(2) });
    }

    return { symbol, prices, confidence: Math.round(72 + Math.random() * 18) };
  }

  /* ─── Helpers ─── */
  function formatVolume(v) {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return v.toString();
  }

  function getCurrentSymbol() { return currentSymbol; }
  function getCompanyName(sym) { return COMPANY_NAMES[sym] || sym; }

  /* ─── Event Listeners ─── */
  window.addEventListener('timeframeChange', async (e) => {
    currentTimeframe = e.detail;
    cachedData = {};
    await loadSymbol(currentSymbol, currentTimeframe);
  });

  window.addEventListener('reloadPredictions', async () => {
    const preds = await fetchPredictions(currentSymbol);
    if (preds?.prices?.length) {
      ChartModule.loadPredictions(preds.prices.map(p => ({ time: p.timestamp, value: p.price })));
    }
  });

  return { loadSymbol, initWatchlist, getCurrentSymbol, getCompanyName, generateDemoOHLCV };
})();

/* ─── Global binding (HTML onclick) ─── */
function selectSymbol(symbol) { StockAPI.loadSymbol(symbol); }
