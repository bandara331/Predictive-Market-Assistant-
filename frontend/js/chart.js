/**
 * chart.js — ApexCharts Integration
 * Candlestick + AI Prediction Line using ApexCharts v3
 */

const ChartModule = (() => {
  let apexChart    = null;
  let currentType  = 'candle';
  let showPreds    = true;
  let lastCandles  = [];
  let lastPreds    = [];

  const CHART_BG   = '#131722';
  const GREEN      = '#26a69a';
  const RED        = '#ef5350';
  const PRED_COLOR = '#f7931a';
  const GRID_COLOR = 'rgba(255,255,255,0.04)';
  const TEXT_COLOR = '#8892a4';

  /* ─── Build ApexCharts options ─── */
  function _buildOptions(candleData, predData, type) {
    const series = [];

    // Main price series
    if (type === 'candle') {
      series.push({
        name: 'Price',
        type: 'candlestick',
        data: candleData
      });
    } else {
      series.push({
        name: 'Close',
        type: 'line',
        data: candleData.map(d => ({ x: d.x, y: d.y[3] })) // close price
      });
    }

    // AI Prediction series
    if (showPreds && predData.length) {
      series.push({
        name: 'AI Prediction',
        type: 'line',
        data: predData
      });
    }

    return {
      series,
      chart: {
        type: type === 'candle' ? 'candlestick' : 'line',
        background: CHART_BG,
        foreColor: TEXT_COLOR,
        fontFamily: "'Inter', sans-serif",
        height: '100%',
        animations: { enabled: false },
        toolbar: {
          show: true,
          tools: { download: false, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
        },
        zoom: { enabled: true }
      },
      theme: { mode: 'dark' },
      plotOptions: {
        candlestick: {
          colors: { upward: GREEN, downward: RED },
          wick: { useFillColor: true }
        }
      },
      colors: [GREEN, PRED_COLOR],
      stroke: {
        curve: 'smooth',
        width: [1, 2],
        dashArray: [0, 4]
      },
      grid: {
        borderColor: GRID_COLOR,
        strokeDashArray: 2,
        xaxis: { lines: { show: true } },
        yaxis: { lines: { show: true } }
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: { colors: TEXT_COLOR, fontSize: '11px' },
          datetimeFormatter: { year: 'yyyy', month: 'MMM yy', day: 'dd MMM', hour: 'HH:mm' }
        },
        axisBorder: { color: 'rgba(255,255,255,0.08)' },
        axisTicks: { color: 'rgba(255,255,255,0.08)' }
      },
      yaxis: {
        tooltip: { enabled: true },
        labels: {
          style: { colors: TEXT_COLOR, fontSize: '11px' },
          formatter: v => v ? `$${v.toFixed(2)}` : ''
        }
      },
      tooltip: {
        theme: 'dark',
        shared: false,
        x: { format: 'dd MMM yyyy' },
        y: {
          formatter: (val, { seriesIndex, dataPointIndex, w }) => {
            if (w.config.series[seriesIndex].type === 'candlestick') return '';
            return val ? `$${val.toFixed(2)}` : '';
          }
        }
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'left',
        labels: { colors: TEXT_COLOR },
        markers: { radius: 2 }
      }
    };
  }

  /* ─── Initialize Chart ─── */
  function init() {
    const container = document.getElementById('tv-chart');
    if (!container || apexChart) return;

    // Make sure container has height
    container.style.height = '100%';
    container.style.minHeight = '340px';

    const opts = _buildOptions([], [], 'candle');
    apexChart = new ApexCharts(container, opts);
    apexChart.render();
    console.log('✅ ApexCharts initialized');
  }

  /* ─── Load Candle Data ─── */
  function loadCandles(ohlcvArray) {
    if (!apexChart) { console.warn('Chart not initialized'); return; }

    // Convert to ApexCharts candlestick format
    // ApexCharts expects: { x: Date | timestamp_ms, y: [open, high, low, close] }
    lastCandles = ohlcvArray
      .map(d => ({
        x: d.time * 1000,           // convert seconds → milliseconds
        y: [d.open, d.high, d.low, d.close]
      }))
      .sort((a, b) => a.x - b.x);

    _redraw();
  }

  /* ─── Load Prediction Line ─── */
  function loadPredictions(predArray) {
    if (!apexChart) return;
    if (!showPreds) { lastPreds = []; _redraw(); return; }

    lastPreds = predArray
      .map(d => ({
        x: d.time * 1000,
        y: parseFloat(d.value.toFixed(2))
      }))
      .sort((a, b) => a.x - b.x);

    _redraw();
  }

  /* ─── Redraw with current data ─── */
  function _redraw() {
    if (!apexChart) return;

    const series = [];

    if (currentType === 'candle') {
      series.push({ name: 'Price', type: 'candlestick', data: lastCandles });
    } else {
      series.push({
        name: 'Close',
        type: 'line',
        data: lastCandles.map(d => ({ x: d.x, y: d.y[3] }))
      });
    }

    if (showPreds && lastPreds.length) {
      series.push({ name: 'AI Prediction', type: 'line', data: lastPreds });
    }

    apexChart.updateSeries(series, true);
  }

  function clearPredictions() {
    lastPreds = [];
    _redraw();
  }

  /* ─── Chart Type Switching ─── */
  function setType(type) {
    currentType = type;

    document.querySelectorAll('.chart-type-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`ct-${type}`)?.classList.add('active');

    // Update chart type in ApexCharts options
    if (apexChart) {
      apexChart.updateOptions({
        chart: { type: type === 'candle' ? 'candlestick' : 'line' }
      }, false, false);
    }

    _redraw();
  }

  function togglePredictions(show) {
    showPreds = show;
    if (!show) {
      lastPreds = [];
    } else {
      window.dispatchEvent(new CustomEvent('reloadPredictions'));
    }
    _redraw();
  }

  function setTimeframe(tf) {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tf-btn').forEach(btn => {
      if (btn.textContent.trim() === tf) btn.classList.add('active');
    });
    window.dispatchEvent(new CustomEvent('timeframeChange', { detail: tf }));
  }

  // Line series (kept for API compat)
  function loadLine(closePriceArray) {
    lastCandles = closePriceArray.map(d => ({
      x: d.time * 1000,
      y: [d.value, d.value, d.value, d.value]
    }));
    _redraw();
  }

  return { init, loadCandles, loadLine, loadPredictions, clearPredictions, setType, togglePredictions, setTimeframe };
})();

/* ─── Global bindings ─── */
function setChartType(type) { ChartModule.setType(type); }
function togglePredictions() {
  const checked = document.getElementById('prediction-toggle')?.checked;
  ChartModule.togglePredictions(checked);
}
function setTimeframe(tf) { ChartModule.setTimeframe(tf); }
