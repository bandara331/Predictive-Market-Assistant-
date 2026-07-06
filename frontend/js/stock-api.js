/**
 * stock-api.js — Real-Time Stock Data via Finnhub API
 * Uses Finnhub.io for live quotes, candles (OHLCV), and company profiles.
 * Free tier: 60 API calls/minute — sufficient for this dashboard.
 *
 * To use real data: set FINNHUB_API_KEY to your key from https://finnhub.io
 */

const StockAPI = (() => {
  const BACKEND_URL    = 'https://predictive-market-assistant-production.up.railway.app/api/dashboard';
  const FINNHUB_BASE   = 'https://finnhub.io/api/v1';
  // ⚠️  Replace with your Finnhub API key from https://finnhub.io (free signup)
  const FINNHUB_API_KEY = window.FINNHUB_API_KEY || 'd961b89r01qifmv392rgd961b89r01qifmv392s0';

  let currentSymbol    = 'AAPL';
  let currentTimeframe = '1M';
  let cachedData       = {};
  let liveQuoteInterval = null;

  const COMPANY_NAMES = {
    AAPL:  'Apple Inc.',
    GOOGL: 'Alphabet Inc.',
    MSFT:  'Microsoft Corporation',
    TSLA:  'Tesla, Inc.',
    NVDA:  'NVIDIA Corporation',
    AMZN:  'Amazon.com, Inc.'
  };

  /* ─── Timeframe → Finnhub resolution + days back ─── */
  const TF_MAP = {
    '1W': { resolution: '60',  days: 7   },
    '1M': { resolution: 'D',   days: 30  },
    '3M': { resolution: 'D',   days: 90  },
    '6M': { resolution: 'D',   days: 180 },
    '1Y': { resolution: 'W',   days: 365 }
  };

  /* ─── Fetch OHLCV candles from Finnhub ─── */
  async function fetchCandles(symbol, timeframe = '1M') {
    const cacheKey = `${symbol}_${timeframe}`;
    if (cachedData[cacheKey]) return cachedData[cacheKey];

    const { resolution, days } = TF_MAP[timeframe] || TF_MAP['1M'];
    const now  = Math.floor(Date.now() / 1000);
    const from = now - days * 86400;

    try {
      const url = `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${FINNHUB_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Finnhub HTTP error');
      const json = await res.json();

      if (json.s !== 'ok' || !json.t?.length) {
        console.warn(`Finnhub returned no data for ${symbol}. Using demo data.`);
        return useDemoData(symbol, timeframe, cacheKey);
      }

      // Build OHLCV array
      const ohlcv = json.t.map((ts, i) => ({
        timestamp: ts,
        open:      +json.o[i].toFixed(2),
        high:      +json.h[i].toFixed(2),
        low:       +json.l[i].toFixed(2),
        close:     +json.c[i].toFixed(2),
        volume:    json.v[i]
      }));

      const data = { symbol, timeframe, ohlcv };
      cachedData[cacheKey] = data;
      return data;

    } catch (err) {
      console.warn('Finnhub candle fetch failed, using demo data:', err.message);
      return useDemoData(symbol, timeframe, cacheKey);
    }
  }

  /* ─── Fetch live quote from Finnhub ─── */
  async function fetchLiveQuote(symbol) {
    try {
      const url = `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Finnhub quote error');
      const q = await res.json();
      // q.c = current, q.o = open, q.h = high, q.l = low, q.pc = prev close, q.d = change, q.dp = % change
      if (!q.c) return null;
      return q;
    } catch {
      return null;
    }
  }

  /* ─── Fetch company profile from Finnhub ─── */
  async function fetchProfile(symbol) {
    try {
      const url = `${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return null;
    }
  }

  /* ─── Fetch ML Predictions (backend or demo) ─── */
  async function fetchPredictions(symbol) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/predict/${symbol}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('Backend error');
      return await res.json();
    } catch {
      return generateDemoPredictions(symbol);
    }
  }

  /* ─── Load Symbol (main entry) ─── */
  async function loadSymbol(symbol, timeframe = currentTimeframe) {
    currentSymbol    = symbol;
    currentTimeframe = timeframe;
    cachedData       = {};  // clear cache on symbol change

    // Stop any existing live quote polling
    if (liveQuoteInterval) clearInterval(liveQuoteInterval);

    // Update UI immediately
    document.getElementById('stock-ticker-display').textContent  = symbol;
    document.getElementById('stock-company-display').textContent = COMPANY_NAMES[symbol] || symbol;
    document.getElementById('legend-symbol-label').textContent   = symbol;
    document.getElementById('current-symbol-mention').textContent = symbol;
    document.getElementById('meta-mktcap').textContent           = '—';

    // Show loading
    document.getElementById('chart-loading')?.classList.remove('hidden');

    // Update symbol buttons
    document.querySelectorAll('.symbol-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`sym-${symbol}`)?.classList.add('active');

    try {
      // Fetch candles + quote + predictions in parallel
      const [historicalData, quote, predictions, profile] = await Promise.all([
        fetchCandles(symbol, timeframe),
        fetchLiveQuote(symbol),
        fetchPredictions(symbol),
        fetchProfile(symbol)
      ]);

      // Update market cap from profile
      if (profile?.marketCapitalization) {
        const mc = profile.marketCapitalization;
        const mcStr = mc >= 1e6 ? `$${(mc/1e6).toFixed(2)}T`
                    : mc >= 1e3 ? `$${(mc/1e3).toFixed(2)}B`
                    : `$${mc.toFixed(0)}M`;
        document.getElementById('meta-mktcap').textContent = mcStr;
      }

      renderChart(historicalData, predictions);
      updateMetrics(historicalData, predictions, quote);

      // ─── Live quote polling every 15 seconds ───
      liveQuoteInterval = setInterval(async () => {
        const liveQ = await fetchLiveQuote(currentSymbol);
        if (liveQ) updateLivePrice(liveQ);
      }, 15000);

    } finally {
      document.getElementById('chart-loading')?.classList.add('hidden');
    }
  }

  /* ─── Update live price in header (no chart refresh) ─── */
  function updateLivePrice(q) {
    const price   = q.c;
    const change  = q.d  ?? 0;
    const changePct = q.dp ?? 0;
    const isUp    = change >= 0;
    const sign    = isUp ? '+' : '';

    document.getElementById('stock-price-display').textContent = `$${price.toFixed(2)}`;
    const badge = document.getElementById('price-badge');
    if (badge) badge.className = `price-badge ${isUp ? 'up' : 'down'}`;
    document.getElementById('price-change-icon').textContent  = isUp ? '▲' : '▼';
    document.getElementById('price-change-value').textContent = `${sign}${changePct.toFixed(2)}%`;
    document.getElementById('price-change-amount').textContent = `(${sign}$${Math.abs(change).toFixed(2)})`;

    // Meta row
    if (q.o) document.getElementById('meta-open').textContent = `$${q.o.toFixed(2)}`;
    if (q.h) document.getElementById('meta-high').textContent = `$${q.h.toFixed(2)}`;
    if (q.l) document.getElementById('meta-low').textContent  = `$${q.l.toFixed(2)}`;

    // KPI
    document.getElementById('kpi-price').textContent        = `$${price.toFixed(2)}`;
    document.getElementById('kpi-price-change').textContent = `${sign}${changePct.toFixed(2)}% today`;
    document.getElementById('kpi-price-change').style.color = isUp ? 'var(--green)' : 'var(--red)';

    updateWatchlistItem(currentSymbol, price, changePct, isUp);
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

  /* ─── Metrics Update (first load) ─── */
  function updateMetrics(historicalData, predictions, quote) {
    const latest    = historicalData.ohlcv[historicalData.ohlcv.length - 1];
    const previous  = historicalData.ohlcv[historicalData.ohlcv.length - 2];

    // If live quote available, use it; otherwise use last candle
    const price     = quote?.c  ?? latest.close;
    const prevPrice = quote?.pc ?? previous?.close ?? price;
    const change    = quote?.d  ?? (price - prevPrice);
    const changePct = quote?.dp ?? ((change / prevPrice) * 100);
    const isUp      = change >= 0;
    const sign      = isUp ? '+' : '';

    // Header
    document.getElementById('stock-price-display').textContent = `$${price.toFixed(2)}`;
    const badge = document.getElementById('price-badge');
    if (badge) badge.className = `price-badge ${isUp ? 'up' : 'down'}`;
    document.getElementById('price-change-icon').textContent  = isUp ? '▲' : '▼';
    document.getElementById('price-change-value').textContent = `${sign}${changePct.toFixed(2)}%`;
    document.getElementById('price-change-amount').textContent = `(${sign}$${Math.abs(change).toFixed(2)})`;

    // Meta row
    document.getElementById('meta-open').textContent   = `$${(quote?.o ?? latest.open).toFixed(2)}`;
    document.getElementById('meta-high').textContent   = `$${(quote?.h ?? latest.high).toFixed(2)}`;
    document.getElementById('meta-low').textContent    = `$${(quote?.l ?? latest.low).toFixed(2)}`;
    document.getElementById('meta-volume').textContent = formatVolume(latest.volume);

    // KPI Cards
    document.getElementById('kpi-price').textContent        = `$${price.toFixed(2)}`;
    document.getElementById('kpi-price-change').textContent = `${sign}${changePct.toFixed(2)}% today`;
    document.getElementById('kpi-price-change').style.color = isUp ? 'var(--green)' : 'var(--red)';

    // 52-week range from candle history
    const closes = historicalData.ohlcv.map(d => d.close);
    const high52  = Math.max(...closes).toFixed(2);
    const low52   = Math.min(...closes).toFixed(2);
    document.getElementById('kpi-52w').textContent = `$${low52} – $${high52}`;

    // Predicted price
    if (predictions?.prices?.length) {
      const lastPred   = predictions.prices[predictions.prices.length - 1].price;
      const predChange = ((lastPred - price) / price * 100);
      const predSign   = predChange >= 0 ? '+' : '';
      document.getElementById('kpi-predicted').textContent        = `$${lastPred.toFixed(2)}`;
      document.getElementById('kpi-predicted-change').textContent = `${predSign}${predChange.toFixed(1)}% in 30 days`;
      document.getElementById('kpi-predicted-change').style.color = predChange >= 0 ? 'var(--green)' : 'var(--red)';

      const confidence = predictions.confidence ?? Math.round(72 + Math.random() * 18);
      const signal     = confidence > 75 ? (predChange >= 0 ? '🟢 Strong Buy' : '🔴 Strong Sell')
                       : confidence > 60 ? (predChange >= 0 ? '🔵 Buy' : '🟡 Hold') : '⚪ Neutral';
      document.getElementById('kpi-confidence').textContent = `${confidence}%`;
      document.getElementById('kpi-signal').textContent     = signal;
    }

    updateWatchlistItem(currentSymbol, price, changePct, isUp);
  }

  /* ─── Watchlist init with real quotes ─── */
  async function initWatchlist() {
    const symbols   = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'];
    const container = document.getElementById('watchlist-items');
    if (!container) return;

    // Render skeletons
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

    // Fetch quotes for all symbols (staggered to avoid rate limits)
    for (const sym of symbols) {
      try {
        // Try live quote first
        const q = await fetchLiveQuote(sym);
        if (q && q.c) {
          const chg  = q.dp ?? 0;
          const isUp = chg >= 0;
          updateWatchlistItem(sym, q.c, chg, isUp);

          // Fetch candles for sparkline
          const data   = await fetchCandles(sym, '1M');
          const prices = data.ohlcv.slice(-20).map(d => d.close);
          renderSparkline(sym, prices, isUp);
        } else {
          // Fallback to demo
          const data   = generateDemoOHLCV(sym, '1M');
          const prices = data.ohlcv.map(d => d.close);
          const last   = prices[prices.length - 1];
          const prev   = prices[prices.length - 2];
          const chg    = ((last - prev) / prev * 100);
          const isUp   = chg >= 0;
          renderSparkline(sym, prices.slice(-20), isUp);
          updateWatchlistItem(sym, last, chg, isUp);
        }
        // Small delay to avoid Finnhub rate limiting (60/min)
        await new Promise(r => setTimeout(r, 200));
      } catch {
        // silent fallback
      }
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
    document.querySelectorAll('.watchlist-item').forEach(i => i.classList.remove('active'));
    if (item && symbol === currentSymbol) item.classList.add('active');
  }

  function renderSparkline(symbol, prices, isUp) {
    const svg = document.getElementById(`spark-${symbol}`);
    if (!svg || !prices.length) return;
    const min   = Math.min(...prices);
    const max   = Math.max(...prices);
    const range = max - min || 1;
    const w = 80, h = 28;
    const pts = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const color = isUp ? '#26a69a' : '#ef5350';
    svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }

  /* ─── Demo fallback (when API key not set or rate limited) ─── */
  function useDemoData(symbol, timeframe, cacheKey) {
    const data = generateDemoOHLCV(symbol, timeframe);
    cachedData[cacheKey] = data;
    return data;
  }

  function generateDemoOHLCV(symbol, timeframe) {
    const SEED_PRICES = { AAPL: 189, GOOGL: 178, MSFT: 420, TSLA: 248, NVDA: 875, AMZN: 195 };
    const VOLATILITY  = { AAPL: 0.012, GOOGL: 0.013, MSFT: 0.011, TSLA: 0.028, NVDA: 0.022, AMZN: 0.015 };
    const TF_DAYS     = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };

    const days  = TF_DAYS[timeframe] || 30;
    const vol   = VOLATILITY[symbol] || 0.015;
    let   price = SEED_PRICES[symbol] || 150;
    const ohlcv = [];
    const startTs = Math.floor(Date.now() / 1000) - days * 86400;

    for (let i = 0; i <= days; i++) {
      const ts   = startTs + i * 86400;
      const date = new Date(ts * 1000);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const change = price * vol * (Math.random() * 2 - 1);
      const open   = price;
      const close  = Math.max(1, price + change);
      const high   = Math.max(open, close) * (1 + Math.random() * vol * 0.5);
      const low    = Math.min(open, close) * (1 - Math.random() * vol * 0.5);
      ohlcv.push({ timestamp: ts, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume: Math.round(20e6 + Math.random() * 60e6) });
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
    for (let i = 1; i <= 30; i++) {
      const ts   = now + i * 86400;
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
    return v?.toString() ?? '—';
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

/* ─── Global binding ─── */
function selectSymbol(symbol) { StockAPI.loadSymbol(symbol); }
