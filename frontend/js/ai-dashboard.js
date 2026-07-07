/**
 * ai-dashboard.js — AI Business & Financial Dashboard (Isolated Add-On)
 *
 * Responsibilities:
 *  - Auth guard (reads JWT from localStorage set by existing auth.js)
 *  - TradingView Lightweight Charts v4: Stock candlestick + prediction line
 *  - TradingView Lightweight Charts v4: SME Demand Forecast chart
 *  - REST calls to /api/ai-dashboard/* (new Java endpoints, JWT-authenticated)
 *  - Groq AI Chat panel wired to /api/ai-dashboard/chat
 *
 * NOTE: This file has ZERO imports from existing JS files. It only reads
 *       localStorage keys that auth.js already writes (predictiq_token, predictiq_user).
 */

'use strict';

/* ─── Constants ─── */
const AID_TOKEN_KEY = 'predictiq_token';
const AID_USER_KEY  = 'predictiq_user';
const AID_API_BASE  = '/api/ai-dashboard';
const AID_SYMBOLS   = ['AAPL','GOOGL','MSFT','TSLA','NVDA','AMZN'];

/* ─── State ─── */
let aidCurrentSymbol  = 'AAPL';
let aidCurrentTf      = '1M';
let aidStockChart     = null;
let aidDemandChart    = null;
let aidCandleSeries   = null;
let aidPredSeries     = null;
let aidDemandSeries   = null;
let aidForecastSeries = null;
let aidChatHistory    = [];
let aidIsSending      = false;

/* ════════════════════════════════════════════════════════
   ENTRY POINT
   ════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  if (!aidCheckAuth()) return;
  aidInitUI();
  aidInitCharts();
  aidLoadData(aidCurrentSymbol, aidCurrentTf);
});

/* ─── Auth Guard ─── */
function aidCheckAuth() {
  const token = localStorage.getItem(AID_TOKEN_KEY);
  if (!token) {
    document.getElementById('aid-auth-error').classList.remove('aid-hidden');
    document.getElementById('aid-main').classList.add('aid-hidden');
    return false;
  }
  // Populate user name in nav
  try {
    const user = JSON.parse(localStorage.getItem(AID_USER_KEY) || '{}');
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
    const el = document.getElementById('aid-user-name');
    if (el) el.textContent = name;
  } catch (_) {}
  return true;
}

function aidGetToken() { return localStorage.getItem(AID_TOKEN_KEY) || ''; }

/* ─── Fetch helper ─── */
async function aidFetch(path, options = {}) {
  const res = await fetch(AID_API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aidGetToken()}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

/* ════════════════════════════════════════════════════════
   SYMBOL & TIMEFRAME SELECTION
   ════════════════════════════════════════════════════════ */
window.aidSelectSymbol = function(sym) {
  if (sym === aidCurrentSymbol) return;
  aidCurrentSymbol = sym;
  document.querySelectorAll('.aid-sym-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`aid-sym-${sym}`);
  if (btn) btn.classList.add('active');
  aidLoadData(aidCurrentSymbol, aidCurrentTf);
};

window.aidSetTf = function(tf, btn) {
  if (tf === aidCurrentTf) return;
  aidCurrentTf = tf;
  document.querySelectorAll('.aid-tf-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  aidLoadData(aidCurrentSymbol, aidCurrentTf);
};

/* ════════════════════════════════════════════════════════
   DATA LOADING ORCHESTRATOR
   ════════════════════════════════════════════════════════ */
async function aidLoadData(symbol, tf) {
  aidShowChartLoading(true);
  try {
    const [analysis, demand] = await Promise.all([
      aidFetch(`/analysis/${symbol}?timeframe=${tf}`).catch(() => null),
      aidFetch(`/demand/${symbol}`).catch(() => null),
    ]);
    if (analysis) {
      aidRenderStockChart(analysis);
      aidUpdateStockCard(analysis);
      aidUpdateKPIs(analysis);
    }
    if (demand) {
      aidRenderDemandChart(demand);
      aidUpdateDemandCard(demand);
    }
  } catch (err) {
    console.warn('[AID] Data load failed:', err);
  }
  aidShowChartLoading(false);
}

function aidShowChartLoading(show) {
  const els = document.querySelectorAll('.aid-chart-loading');
  els.forEach(el => show ? el.classList.remove('hidden') : el.classList.add('hidden'));
}

/* ════════════════════════════════════════════════════════
   CHART INITIALIZATION — TradingView Lightweight Charts v4
   ════════════════════════════════════════════════════════ */
function aidInitCharts() {
  if (typeof LightweightCharts === 'undefined') {
    console.warn('[AID] LightweightCharts not loaded yet');
    setTimeout(aidInitCharts, 500);
    return;
  }

  /* ─── Stock Chart ─── */
  const stockEl = document.getElementById('aid-stock-chart');
  aidStockChart = LightweightCharts.createChart(stockEl, {
    layout: { background: { color: '#131722' }, textColor: '#8b95b0' },
    grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)', textColor: '#8b95b0' },
    timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
    width:  stockEl.clientWidth,
    height: stockEl.clientHeight || 320,
  });
  aidCandleSeries = aidStockChart.addCandlestickSeries({
    upColor:   '#26a69a', downColor: '#ef5350',
    borderUpColor: '#26a69a', borderDownColor: '#ef5350',
    wickUpColor:   '#26a69a', wickDownColor:   '#ef5350',
  });
  aidPredSeries = aidStockChart.addLineSeries({
    color: '#00d4ff', lineWidth: 2,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    lastValueVisible: true, priceLineVisible: false,
  });

  /* ─── Demand Chart ─── */
  const demandEl = document.getElementById('aid-demand-chart');
  aidDemandChart = LightweightCharts.createChart(demandEl, {
    layout: { background: { color: '#131722' }, textColor: '#8b95b0' },
    grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
    timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
    width:  demandEl.clientWidth,
    height: demandEl.clientHeight || 220,
  });
  aidDemandSeries = aidDemandChart.addHistogramSeries({
    color: '#7b61ff', priceLineVisible: false,
  });
  aidForecastSeries = aidDemandChart.addLineSeries({
    color: '#f7931a', lineWidth: 2,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    priceLineVisible: false,
  });

  /* Resize observer */
  const ro = new ResizeObserver(() => {
    if (aidStockChart)  aidStockChart.applyOptions({ width: stockEl.clientWidth });
    if (aidDemandChart) aidDemandChart.applyOptions({ width: demandEl.clientWidth });
  });
  ro.observe(stockEl);
  ro.observe(demandEl);
}

/* ─── Render Stock Chart ─── */
function aidRenderStockChart(data) {
  if (!aidCandleSeries || !aidPredSeries) return;
  const candles = (data.ohlcv || []).map(d => ({
    time:  Math.floor(new Date(d.date || d.timestamp).getTime() / 1000),
    open:  parseFloat(d.open),
    high:  parseFloat(d.high),
    low:   parseFloat(d.low),
    close: parseFloat(d.close),
  })).filter(c => c.time && !isNaN(c.open));

  const preds = (data.predictions || []).map(d => ({
    time:  Math.floor(new Date(d.date || d.timestamp).getTime() / 1000),
    value: parseFloat(d.price),
  })).filter(p => p.time && !isNaN(p.value));

  if (candles.length > 0) { aidCandleSeries.setData(candles); }
  if (preds.length   > 0) { aidPredSeries.setData(preds); }
  aidStockChart.timeScale().fitContent();
}

/* ─── Render Demand Chart ─── */
function aidRenderDemandChart(data) {
  if (!aidDemandSeries || !aidForecastSeries) return;
  const hist = (data.historical || []).map(d => ({
    time:  Math.floor(new Date(d.date).getTime() / 1000),
    value: parseFloat(d.demand),
    color: '#7b61ff',
  })).filter(d => d.time && !isNaN(d.value));

  const forecast = (data.forecast || []).map(d => ({
    time:  Math.floor(new Date(d.date).getTime() / 1000),
    value: parseFloat(d.demand),
  })).filter(d => d.time && !isNaN(d.value));

  if (hist.length     > 0) { aidDemandSeries.setData(hist); }
  if (forecast.length > 0) { aidForecastSeries.setData(forecast); }
  aidDemandChart.timeScale().fitContent();
}

/* ════════════════════════════════════════════════════════
   UI UPDATES — Stock Card, KPIs, Demand Card
   ════════════════════════════════════════════════════════ */
function aidUpdateStockCard(data) {
  aidSetText('aid-stock-sym',  data.symbol || aidCurrentSymbol);
  aidSetText('aid-stock-name-full', data.companyName || '');
  const price  = parseFloat(data.currentPrice || 0);
  const change = parseFloat(data.changePercent || 0);
  aidSetText('aid-stock-price', price ? `$${price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '$—');
  const badge = document.getElementById('aid-price-badge');
  if (badge) {
    badge.textContent = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`;
    badge.className = `aid-price-badge ${change >= 0 ? 'up' : 'down'}`;
  }
  aidSetText('aid-meta-open',    data.open    ? `$${parseFloat(data.open).toFixed(2)}`    : '—');
  aidSetText('aid-meta-high',    data.high    ? `$${parseFloat(data.high).toFixed(2)}`    : '—');
  aidSetText('aid-meta-low',     data.low     ? `$${parseFloat(data.low).toFixed(2)}`     : '—');
  aidSetText('aid-meta-volume',  data.volume  ? aidFmtVolume(data.volume)                 : '—');
  aidSetText('aid-meta-mktcap',  data.marketCap ? aidFmtVolume(data.marketCap)            : '—');
  aidSetText('aid-meta-pe',      data.peRatio   ? parseFloat(data.peRatio).toFixed(1)     : '—');
}

function aidUpdateKPIs(data) {
  const price     = parseFloat(data.currentPrice || 0);
  const predicted = parseFloat(data.predictedPrice || 0);
  const conf      = parseFloat(data.confidence || 0);
  const change    = parseFloat(data.changePercent || 0);

  aidSetText('aid-kpi-price',     price     ? `$${price.toFixed(2)}`     : '$—');
  aidSetText('aid-kpi-pred',      predicted ? `$${predicted.toFixed(2)}` : '$—');
  aidSetText('aid-kpi-conf',      conf      ? `${conf.toFixed(0)}%`      : '—%');
  aidSetText('aid-kpi-change',    `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);

  const changeEl = document.getElementById('aid-kpi-change');
  if (changeEl) changeEl.className = `aid-kpi-value ${change >= 0 ? 'up' : 'down'}`;

  const signal = conf >= 70 ? 'BULLISH' : conf >= 45 ? 'NEUTRAL' : 'BEARISH';
  const sigEl  = document.getElementById('aid-kpi-signal');
  if (sigEl) {
    sigEl.textContent  = signal;
    sigEl.className    = `aid-demand-badge ${signal.toLowerCase()}`;
  }
}

function aidUpdateDemandCard(data) {
  aidSetText('aid-demand-trend',   data.trend        || '—');
  aidSetText('aid-demand-peak',    data.peakDemand   ? aidFmtVolume(data.peakDemand) : '—');
  aidSetText('aid-demand-avg',     data.avgDemand    ? aidFmtVolume(data.avgDemand)  : '—');
  aidSetText('aid-demand-outlook', data.outlook      || '—');

  const badge = document.getElementById('aid-demand-outlook-badge');
  if (badge) {
    const outlook = (data.outlook || '').toLowerCase();
    badge.className = `aid-demand-badge ${outlook.includes('bull') ? 'bullish' : outlook.includes('bear') ? 'bearish' : 'neutral'}`;
    badge.textContent = data.outlook || '—';
  }
}

/* ════════════════════════════════════════════════════════
   GROQ AI CHAT
   ════════════════════════════════════════════════════════ */
window.aidSendQuick = function(msg) {
  const ta = document.getElementById('aid-chat-input');
  if (ta) ta.value = msg;
  aidSendMessage();
};

window.aidHandleKey = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    aidSendMessage();
  }
};

window.aidAutoResize = function(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight, 100)}px`;
};

window.aidSendMessage = async function() {
  const ta   = document.getElementById('aid-chat-input');
  const msg  = (ta?.value || '').trim();
  if (!msg || aidIsSending) return;

  ta.value = '';
  ta.style.height = 'auto';

  aidAppendMsg(msg, 'user');
  aidChatHistory.push({ role: 'user', content: msg });
  aidIsSending = true;

  const sendBtn = document.getElementById('aid-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  const typingId = aidShowTyping();

  try {
    const res = await aidFetch('/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: msg,
        symbol:  aidCurrentSymbol,
        history: aidChatHistory.slice(-10),
      }),
    });
    aidRemoveTyping(typingId);
    const reply = res.reply || res.message || '...';
    aidAppendMsg(reply, 'ai');
    aidChatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    aidRemoveTyping(typingId);
    aidAppendMsg('⚠️ Could not reach the AI service. Please check your connection.', 'ai');
    console.error('[AID] Chat error:', err);
  } finally {
    aidIsSending = false;
    if (sendBtn) sendBtn.disabled = false;
    ta?.focus();
  }
};

function aidAppendMsg(text, role) {
  const box = document.getElementById('aid-messages');
  if (!box) return;

  const wrapper = document.createElement('div');
  wrapper.className = `aid-msg aid-msg--${role}`;

  const av = document.createElement('div');
  av.className = 'aid-msg-av';
  av.textContent = role === 'ai' ? 'AI' : aidGetUserInitial();

  const bubble = document.createElement('div');
  bubble.className = 'aid-msg-bubble';
  const p = document.createElement('p');
  p.innerHTML = aidEscape(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  bubble.appendChild(p);

  wrapper.appendChild(av);
  wrapper.appendChild(bubble);
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
}

function aidShowTyping() {
  const box = document.getElementById('aid-messages');
  if (!box) return null;
  const id = `aid-typing-${Date.now()}`;
  const wrapper = document.createElement('div');
  wrapper.className = 'aid-msg aid-msg--ai';
  wrapper.id = id;
  wrapper.innerHTML = `
    <div class="aid-msg-av">AI</div>
    <div class="aid-msg-bubble">
      <div class="aid-typing">
        <div class="aid-typing-dot"></div>
        <div class="aid-typing-dot"></div>
        <div class="aid-typing-dot"></div>
      </div>
    </div>`;
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
  return id;
}

function aidRemoveTyping(id) {
  if (!id) return;
  document.getElementById(id)?.remove();
}

/* ════════════════════════════════════════════════════════
   UI INITIALIZATION
   ════════════════════════════════════════════════════════ */
function aidInitUI() {
  // Initial AI greeting
  aidAppendMsg(
    `👋 Hello! I'm your **AI Financial Analyst** powered by Groq. I'm ready to analyze **${aidCurrentSymbol}** — ask me about trends, predictions, risk, or business strategy.`,
    'ai'
  );
  // Market status clock
  aidStartClock();
}

function aidStartClock() {
  function tick() {
    const now = new Date();
    const et  = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true, timeZone: 'America/New_York',
    });
    const el = document.getElementById('aid-clock');
    if (el) el.textContent = `NYSE ${et}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════ */
function aidSetText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function aidFmtVolume(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9)  return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6)  return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3)  return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

function aidEscape(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function aidGetUserInitial() {
  try {
    const user = JSON.parse(localStorage.getItem(AID_USER_KEY) || '{}');
    return (user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase();
  } catch (_) { return 'U'; }
}
