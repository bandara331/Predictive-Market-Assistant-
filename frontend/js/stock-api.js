/**
 * stock-api.js — Real-Time Stock Data
 * Chart (OHLCV): Yahoo Finance API via CORS proxy (no API key needed)
 * Live Quotes:   Finnhub API (free tier, 60 calls/min)
 * Predictions:   Spring Boot backend / demo fallback
 */

const StockAPI = (() => {
  const BACKEND_URL    = 'https://predictive-market-assistant-production.up.railway.app/api/dashboard';
  const FINNHUB_BASE   = 'https://finnhub.io/api/v1';
  const FINNHUB_KEY    = 'd961b89r01qifmv392rgd961b89r01qifmv392s0';

  // Yahoo Finance via CORS proxy
  const YAHOO_BASE     = 'https://query1.finance.yahoo.com/v8/finance/chart';
  const CORS_PROXY     = 'https://corsproxy.io/?';

  let currentSymbol    = 'AAPL';
  let currentTimeframe = '1M';
  let cachedData       = {};
  let liveQuoteTimer   = null;

  const COMPANY_NAMES = {
    AAPL:  'Apple Inc.',
    GOOGL: 'Alphabet Inc.',
    MSFT:  'Microsoft Corporation',
    TSLA:  'Tesla, Inc.',
    NVDA:  'NVIDIA Corporation',
    AMZN:  'Amazon.com, Inc.'
  };

  /* ─── Timeframe → Yahoo Finance params ─── */
  const TF_YAHOO = {
    '1W': { range: '5d',  interval: '1d'  },
    '1M': { range: '1mo', interval: '1d'  },
    '3M': { range: '3mo', interval: '1d'  },
    '6M': { range: '6mo', interval: '1d'  },
    '1Y': { range: '1y',  interval: '1wk' }
  };

  /* ═══════════════════════════════════════════
     YAHOO FINANCE — OHLCV Candle Data
  ═══════════════════════════════════════════ */
  async function fetchCandles(symbol, timeframe = '1M') {
    const cacheKey = `${symbol}_${timeframe}`;
    if (cachedData[cacheKey]) return cachedData[cacheKey];

    const { range, interval } = TF_YAHOO[timeframe] || TF_YAHOO['1M'];

    // Try Yahoo Finance via CORS proxy
    const yahooUrl = `${YAHOO_BASE}/${symbol}?range=${range}&interval=${interval}&includePrePost=false`;

    // Try primary proxy, then fallback proxy
    const proxies = [
      `${CORS_PROXY}${encodeURIComponent(yahooUrl)}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(yahooUrl)}`
    ];

    for (const proxyUrl of proxies) {
      try {
        const res = await fetch(proxyUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!res.ok) continue;

        let json;
        const text = await res.text();

        // allorigins wraps in { contents: "..." }
        if (proxyUrl.includes('allorigins')) {
          const outer = JSON.parse(text);
          json = JSON.parse(outer.contents);
        } else {
          json = JSON.parse(text);
        }

        const result = json?.chart?.result?.[0];
        if (!result?.timestamp?.length) continue;

        const quote  = result.indicators.quote[0];
        const ohlcv  = result.timestamp
          .map((ts, i) => ({
            timestamp: ts,
            open:      +(quote.open[i]  || 0).toFixed(2),
            high:      +(quote.high[i]  || 0).toFixed(2),
            low:       +(quote.low[i]   || 0).toFixed(2),
            close:     +(quote.close[i] || 0).toFixed(2),
            volume:    quote.volume[i]  || 0
          }))
          .filter(d => d.close > 0); // remove null/zero candles

        if (!ohlcv.length) continue;

        const data = { symbol, timeframe, ohlcv };
        cachedData[cacheKey] = data;
        console.log(`✅ Yahoo Finance: ${ohlcv.length} candles for ${symbol}`);
        return data;

      } catch (err) {
        console.warn(`Proxy failed (${proxyUrl.substring(0, 40)}...):`, err.message);
      }
    }

    // All proxies failed — use demo data
    console.warn(`⚠️ All proxies failed for ${symbol}. Using demo data.`);
    const data = generateDemoOHLCV(symbol, timeframe);
    cachedData[cacheKey] = data;
    return data;
  }

  /* ═══════════════════════════════════════════
     FINNHUB — Live Quote (price, change, O/H/L)
  ═══════════════════════════════════════════ */
  async function fetchLiveQuote(symbol) {
    try {
      const res = await fetch(
        `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
      );
      if (!res.ok) throw new Error('Finnhub HTTP error');
      const q = await res.json();
      return q?.c ? q : null; // q.c = current price
    } catch {
      return null;
    }
  }

  /* ═══════════════════════════════════════════
     FINNHUB — Company Profile (market cap)
  ═══════════════════════════════════════════ */
  async function fetchProfile(symbol) {
    try {
      const res = await fetch(
        `${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`
      );
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return null;
    }
  }

  /* ═══════════════════════════════════════════
     BACKEND — ML Predictions
  ═══════════════════════════════════════════ */
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

  /* ═══════════════════════════════════════════
     MAIN — Load Symbol
  ═══════════════════════════════════════════ */
  async function loadSymbol(symbol, timeframe = currentTimeframe) {
    currentSymbol    = symbol;
    currentTimeframe = timeframe;
    cachedData       = {};

    // Stop any live quote polling
    if (liveQuoteTimer) { clearInterval(liveQuoteTimer); liveQuoteTimer = null; }

    // Update UI immediately
    document.getElementById('stock-ticker-display').textContent  = symbol;
    document.getElementById('stock-company-display').textContent = COMPANY_NAMES[symbol] || symbol;
    document.getElementById('legend-symbol-label').textContent   = symbol;
    document.getElementById('current-symbol-mention').textContent = symbol;
    document.getElementById('meta-mktcap').textContent           = '—';

    document.getElementById('chart-loading')?.classList.remove('hidden');
    document.querySelectorAll('.symbol-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`sym-${symbol}`)?.classList.add('active');

    try {
      const [historicalData, quote, predictions, profile] = await Promise.all([
        fetchCandles(symbol, timeframe),
        fetchLiveQuote(symbol),
        fetchPredictions(symbol),
        fetchProfile(symbol)
      ]);

      // Market cap from Finnhub profile
      if (profile?.marketCapitalization) {
        const mc = profile.marketCapitalization;
        const mcStr = mc >= 1e6 ? `$${(mc/1e6).toFixed(2)}T`
                    : mc >= 1e3 ? `$${(mc/1e3).toFixed(2)}B`
                    : `$${mc.toFixed(0)}M`;
        document.getElementById('meta-mktcap').textContent = mcStr;
      }

      renderChart(historicalData, predictions);
      updateMetrics(historicalData, predictions, quote);

      // Live price refresh every 15s
      liveQuoteTimer = setInterval(async () => {
        const lq = await fetchLiveQuote(currentSymbol);
        if (lq) updateLivePrice(lq);
      }, 15000);

    } finally {
      document.getElementById('chart-loading')?.classList.add('hidden');
    }
  }

  /* ─── Update live price in header only ─── */
  function updateLivePrice(q) {
    const price     = q.c;
    const change    = q.d  ?? 0;
    const changePct = q.dp ?? 0;
    const isUp      = change >= 0;
    const sign      = isUp ? '+' : '';

    document.getElementById('stock-price-display').textContent  = `$${price.toFixed(2)}`;
    const badge = document.getElementById('price-badge');
    if (badge) badge.className = `price-badge ${isUp ? 'up' : 'down'}`;
    document.getElementById('price-change-icon').textContent   = isUp ? '▲' : '▼';
    document.getElementById('price-change-value').textContent  = `${sign}${changePct.toFixed(2)}%`;
    document.getElementById('price-change-amount').textContent = `(${sign}$${Math.abs(change).toFixed(2)})`;
    if (q.o) document.getElementById('meta-open').textContent  = `$${q.o.toFixed(2)}`;
    if (q.h) document.getElementById('meta-high').textContent  = `$${q.h.toFixed(2)}`;
    if (q.l) document.getElementById('meta-low').textContent   = `$${q.l.toFixed(2)}`;
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
      ChartModule.loadPredictions(
        predictions.prices.map(p => ({ time: p.timestamp, value: p.price }))
      );
    }
  }

  /* ─── Metrics ─── */
  function updateMetrics(historicalData, predictions, quote) {
    const latest    = historicalData.ohlcv[historicalData.ohlcv.length - 1];
    const previous  = historicalData.ohlcv[historicalData.ohlcv.length - 2];
    const price     = quote?.c  ?? latest.close;
    const prevPrice = quote?.pc ?? previous?.close ?? price;
    const change    = quote?.d  ?? (price - prevPrice);
    const changePct = quote?.dp ?? ((change / prevPrice) * 100);
    const isUp      = change >= 0;
    const sign      = isUp ? '+' : '';

    document.getElementById('stock-price-display').textContent  = `$${price.toFixed(2)}`;
    const badge = document.getElementById('price-badge');
    if (badge) badge.className = `price-badge ${isUp ? 'up' : 'down'}`;
    document.getElementById('price-change-icon').textContent   = isUp ? '▲' : '▼';
    document.getElementById('price-change-value').textContent  = `${sign}${changePct.toFixed(2)}%`;
    document.getElementById('price-change-amount').textContent = `(${sign}$${Math.abs(change).toFixed(2)})`;
    document.getElementById('meta-open').textContent   = `$${(quote?.o ?? latest.open).toFixed(2)}`;
    document.getElementById('meta-high').textContent   = `$${(quote?.h ?? latest.high).toFixed(2)}`;
    document.getElementById('meta-low').textContent    = `$${(quote?.l ?? latest.low).toFixed(2)}`;
    document.getElementById('meta-volume').textContent = formatVolume(latest.volume);
    document.getElementById('kpi-price').textContent        = `$${price.toFixed(2)}`;
    document.getElementById('kpi-price-change').textContent = `${sign}${changePct.toFixed(2)}% today`;
    document.getElementById('kpi-price-change').style.color = isUp ? 'var(--green)' : 'var(--red)';

    const closes = historicalData.ohlcv.map(d => d.close);
    document.getElementById('kpi-52w').textContent =
      `$${Math.min(...closes).toFixed(2)} – $${Math.max(...closes).toFixed(2)}`;

    if (predictions?.prices?.length) {
      const lastPred   = predictions.prices[predictions.prices.length - 1].price;
      const predChange = ((lastPred - price) / price * 100);
      const predSign   = predChange >= 0 ? '+' : '';
      document.getElementById('kpi-predicted').textContent        = `$${lastPred.toFixed(2)}`;
      document.getElementById('kpi-predicted-change').textContent = `${predSign}${predChange.toFixed(1)}% in 30 days`;
      document.getElementById('kpi-predicted-change').style.color = predChange >= 0 ? 'var(--green)' : 'var(--red)';
      const conf   = predictions.confidence ?? Math.round(72 + Math.random() * 18);
      const signal = conf > 75 ? (predChange >= 0 ? '🟢 Strong Buy' : '🔴 Strong Sell')
                   : conf > 60 ? (predChange >= 0 ? '🔵 Buy' : '🟡 Hold') : '⚪ Neutral';
      document.getElementById('kpi-confidence').textContent = `${conf}%`;
      document.getElementById('kpi-signal').textContent     = signal;
    }

    updateWatchlistItem(currentSymbol, price, changePct, isUp);
  }

  /* ─── Watchlist ─── */
  async function initWatchlist() {
    const symbols   = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMZN'];
    const container = document.getElementById('watchlist-items');
    if (!container) return;

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

    // Stagger requests to avoid rate limits
    for (const sym of symbols) {
      try {
        const [q, data] = await Promise.all([
          fetchLiveQuote(sym),
          fetchCandles(sym, '1M')
        ]);
        const price = q?.c ?? data.ohlcv[data.ohlcv.length - 1].close;
        const chg   = q?.dp ?? 0;
        const isUp  = chg >= 0;
        updateWatchlistItem(sym, price, chg, isUp);
        renderSparkline(sym, data.ohlcv.slice(-20).map(d => d.close), isUp);
        await new Promise(r => setTimeout(r, 150)); // small delay
      } catch { /* silent */ }
    }
  }

  function updateWatchlistItem(symbol, price, changePct, isUp) {
    const priceEl = document.getElementById(`wl-price-${symbol}`);
    const chgEl   = document.getElementById(`wl-chg-${symbol}`);
    const item    = document.getElementById(`wl-${symbol}`);
    if (priceEl) priceEl.textContent = `$${price.toFixed(2)}`;
    if (chgEl) {
      chgEl.textContent = `${isUp ? '+' : ''}${changePct.toFixed(2)}%`;
      chgEl.className   = `wl-change ${isUp ? 'up' : 'down'}`;
    }
    document.querySelectorAll('.watchlist-item').forEach(i => i.classList.remove('active'));
    if (item && symbol === currentSymbol) item.classList.add('active');
  }

  function renderSparkline(symbol, prices, isUp) {
    const svg = document.getElementById(`spark-${symbol}`);
    if (!svg || !prices.length) return;
    const min = Math.min(...prices), max = Math.max(...prices);
    const range = max - min || 1;
    const w = 80, h = 28;
    const pts = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="${isUp ? '#26a69a' : '#ef5350'}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }

  /* ─── Demo Fallback ─── */
  function generateDemoOHLCV(symbol, timeframe) {
    const SEED  = { AAPL: 189, GOOGL: 178, MSFT: 420, TSLA: 248, NVDA: 875, AMZN: 195 };
    const VOL   = { AAPL: 0.012, GOOGL: 0.013, MSFT: 0.011, TSLA: 0.028, NVDA: 0.022, AMZN: 0.015 };
    const DAYS  = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const days  = DAYS[timeframe] || 30;
    const vol   = VOL[symbol] || 0.015;
    let   price = SEED[symbol] || 150;
    const ohlcv = [];
    const start = Math.floor(Date.now() / 1000) - days * 86400;
    for (let i = 0; i <= days; i++) {
      const ts   = start + i * 86400;
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
    const SEED  = { AAPL: 189, GOOGL: 178, MSFT: 420, TSLA: 248, NVDA: 875, AMZN: 195 };
    const TREND = { AAPL: 1.003, GOOGL: 1.002, MSFT: 1.004, TSLA: 0.997, NVDA: 1.005, AMZN: 1.003 };
    let price = SEED[symbol] || 150;
    const trend = TREND[symbol] || 1.002;
    const prices = [];
    const now = Math.floor(Date.now() / 1000);
    for (let i = 1; i <= 30; i++) {
      const ts   = now + i * 86400;
      const date = new Date(ts * 1000);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      price = price * trend + price * 0.008 * (Math.random() * 2 - 1);
      prices.push({ timestamp: ts, price: +price.toFixed(2) });
    }
    return { symbol, prices, confidence: Math.round(72 + Math.random() * 18) };
  }

  /* ─── Helpers ─── */
  function formatVolume(v) {
    if (!v) return '—';
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return v.toString();
  }

  function getCurrentSymbol() { return currentSymbol; }
  function getCompanyName(sym) { return COMPANY_NAMES[sym] || sym; }

  /* ─── Events ─── */
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

function selectSymbol(symbol) { StockAPI.loadSymbol(symbol); }
