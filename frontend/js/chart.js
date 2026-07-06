/**
 * chart.js — TradingView Lightweight Charts Integration
 * Handles: Chart init, candlestick series, LSTM prediction line, resize
 */

const ChartModule = (() => {
  let chart         = null;
  let candleSeries  = null;
  let lineSeries    = null;
  let predSeries    = null;
  let currentType   = 'candle';
  let showPreds     = true;

  const CHART_BG      = '#131722';
  const GRID_COLOR    = 'rgba(255,255,255,0.04)';
  const BORDER_COLOR  = 'rgba(255,255,255,0.08)';
  const TEXT_COLOR    = '#8892a4';
  const GREEN_UP      = '#26a69a';
  const RED_DOWN      = '#ef5350';
  const PRED_COLOR    = '#f7931a';

  /* ─── Initialize Chart ─── */
  function init() {
    const container = document.getElementById('tv-chart');
    if (!container || chart) return;

    chart = LightweightCharts.createChart(container, {
      layout: {
        background:  { type: 'solid', color: CHART_BG },
        textColor:   TEXT_COLOR,
        fontFamily:  "'Inter', sans-serif",
        fontSize:    11,
      },
      grid: {
        vertLines:   { color: GRID_COLOR, style: LightweightCharts.LineStyle.Dotted },
        horzLines:   { color: GRID_COLOR, style: LightweightCharts.LineStyle.Dotted },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0,212,255,0.4)',
          width: 1,
          style: LightweightCharts.LineStyle.Dashed,
          labelBackgroundColor: '#0f1424',
        },
        horzLine: {
          color: 'rgba(0,212,255,0.4)',
          width: 1,
          labelBackgroundColor: '#0f1424',
        },
      },
      rightPriceScale: {
        borderColor:  BORDER_COLOR,
        scaleMargins: { top: 0.1, bottom: 0.15 },
      },
      timeScale: {
        borderColor:         BORDER_COLOR,
        timeVisible:         true,
        secondsVisible:      false,
        rightBarStaysOnScroll: true,
        fixLeftEdge:         true,
      },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
    });

    _addCandleSeries();
    _addPredSeries();
    _setupResizeObserver(container);
    _setupCrosshairSubscription();
  }

  function _addCandleSeries() {
    candleSeries = chart.addCandlestickSeries({
      upColor:          GREEN_UP,
      downColor:        RED_DOWN,
      borderUpColor:    GREEN_UP,
      borderDownColor:  RED_DOWN,
      wickUpColor:      GREEN_UP,
      wickDownColor:    RED_DOWN,
    });
  }

  function _addLineSeries() {
    lineSeries = chart.addLineSeries({
      color:      GREEN_UP,
      lineWidth:  2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius:  4,
    });
  }

  function _addPredSeries() {
    predSeries = chart.addLineSeries({
      color:          PRED_COLOR,
      lineWidth:      2,
      lineStyle:      LightweightCharts.LineStyle.Dashed,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius:  4,
      crosshairMarkerBorderColor: PRED_COLOR,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor:   PRED_COLOR,
      priceLineWidth:   1,
      priceLineStyle:   LightweightCharts.LineStyle.Dashed,
      title:            'AI Pred',
    });
  }

  function _setupResizeObserver(container) {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(container);
  }

  function _setupCrosshairSubscription() {
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time || !candleSeries) return;
      const candle = param.seriesData?.get(candleSeries);
      if (!candle) return;
      // Update header price on hover
      document.getElementById('stock-price-display').textContent = `$${candle.close.toFixed(2)}`;
    });
  }

  /* ─── Timestamp helper ─── */
  function _toChartTime(ts) {
    // TradingView expects UNIX seconds for intraday, or 'YYYY-MM-DD' for daily+
    // Always use date string to avoid timezone issues
    const d = new Date(ts * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* ─── Data Loading ─── */
  function loadCandles(ohlcvArray) {
    if (!candleSeries) return;
    // Convert timestamps → 'YYYY-MM-DD', deduplicate same-day entries, sort ascending
    const seen = new Set();
    const sorted = ohlcvArray
      .map(d => ({ ...d, time: _toChartTime(d.time) }))
      .filter(d => { if (seen.has(d.time)) return false; seen.add(d.time); return true; })
      .sort((a, b) => (a.time < b.time ? -1 : 1));
    candleSeries.setData(sorted);
    chart.timeScale().fitContent();
  }

  function loadLine(closePriceArray) {
    if (!lineSeries) return;
    const seen = new Set();
    const sorted = closePriceArray
      .map(d => ({ ...d, time: _toChartTime(d.time) }))
      .filter(d => { if (seen.has(d.time)) return false; seen.add(d.time); return true; })
      .sort((a, b) => (a.time < b.time ? -1 : 1));
    lineSeries.setData(sorted);
    chart.timeScale().fitContent();
  }

  function loadPredictions(predArray) {
    if (!predSeries) return;
    if (!showPreds) { predSeries.setData([]); return; }
    const seen = new Set();
    const sorted = predArray
      .map(d => ({ ...d, time: _toChartTime(d.time) }))
      .filter(d => { if (seen.has(d.time)) return false; seen.add(d.time); return true; })
      .sort((a, b) => (a.time < b.time ? -1 : 1));
    predSeries.setData(sorted);
  }

  function clearPredictions() {
    predSeries?.setData([]);
  }

  /* ─── Chart Type Switching ─── */
  function setType(type) {
    currentType = type;
    document.querySelectorAll('.chart-type-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`ct-${type}`)?.classList.add('active');

    if (type === 'candle') {
      if (lineSeries) { chart.removeSeries(lineSeries); lineSeries = null; }
      if (!candleSeries) _addCandleSeries();
    } else {
      if (candleSeries) { chart.removeSeries(candleSeries); candleSeries = null; }
      if (!lineSeries) _addLineSeries();
    }
  }

  function togglePredictions(show) {
    showPreds = show;
    if (!show) {
      predSeries?.setData([]);
    } else {
      // Re-request data via event
      window.dispatchEvent(new CustomEvent('reloadPredictions'));
    }
  }

  function setTimeframe(tf) {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tf-btn').forEach(btn => {
      if (btn.textContent.trim() === tf) btn.classList.add('active');
    });
    window.dispatchEvent(new CustomEvent('timeframeChange', { detail: tf }));
  }

  return { init, loadCandles, loadLine, loadPredictions, clearPredictions, setType, togglePredictions, setTimeframe };
})();

/* ─── Global Binding (called from HTML onclick) ─── */
function setChartType(type) {
  ChartModule.setType(type);
}

function togglePredictions() {
  const checked = document.getElementById('prediction-toggle')?.checked;
  ChartModule.togglePredictions(checked);
}

function setTimeframe(tf) {
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  // Find the button that triggered the click and set active
  document.querySelectorAll('.tf-btn').forEach(btn => {
    if (btn.textContent.trim() === tf) btn.classList.add('active');
  });
  window.dispatchEvent(new CustomEvent('timeframeChange', { detail: tf }));
}
