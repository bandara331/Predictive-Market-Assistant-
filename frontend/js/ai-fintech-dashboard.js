// AI Fintech & Business Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
  initTradingViewChart();
  setupLoanPredictor();
  fetchFraudAlerts();
  setupBankReportGenerator();
});

// 1. TradingView Lightweight Charts
let chart;
let areaSeries;

function initTradingViewChart() {
  const chartContainer = document.getElementById('tv-chart');
  chart = LightweightCharts.createChart(chartContainer, {
    width: chartContainer.clientWidth,
    height: chartContainer.clientHeight,
    layout: {
      backgroundColor: '#131722',
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
      horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: 'rgba(197, 203, 206, 0.8)',
    },
    timeScale: {
      borderColor: 'rgba(197, 203, 206, 0.8)',
      timeVisible: true,
    },
  });

  areaSeries = chart.addAreaSeries({
    topColor: 'rgba(99, 102, 241, 0.4)',
    bottomColor: 'rgba(99, 102, 241, 0.0)',
    lineColor: '#6366f1',
    lineWidth: 2,
  });

  // Generate some synthetic historical cash-flow data
  const data = generateSyntheticData();
  areaSeries.setData(data);

  // Resize handler
  window.addEventListener('resize', () => {
    chart.applyOptions({
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
    });
  });
}

function generateSyntheticData() {
  const data = [];
  let time = new Date('2023-01-01').getTime();
  let value = 10000;
  for (let i = 0; i < 365; i++) {
    value += (Math.random() - 0.45) * 500;
    data.push({
      time: time / 1000,
      value: value
    });
    time += 86400000; // +1 day
  }
  return data;
}

// 2. Micro-Loan Predictor
function setupLoanPredictor() {
  const form = document.getElementById('loan-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const amount = document.getElementById('loan-amount').value;
    const revenue = document.getElementById('business-revenue').value;
    
    document.getElementById('credit-score').innerText = '...';
    document.getElementById('credit-status').innerText = 'Evaluating...';
    document.getElementById('credit-status').className = 'score-status';

    try {
      const response = await fetch('http://localhost:8080/api/fintech/loan-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanAmount: parseFloat(amount), businessRevenue: parseFloat(revenue) })
      });
      
      const result = await response.json();
      
      // Update UI
      const scoreElement = document.getElementById('credit-score');
      const statusElement = document.getElementById('credit-status');
      
      scoreElement.innerText = result.creditScore;
      
      if (result.repaymentProbability > 0.8) {
        statusElement.innerText = 'High Probability - Approved';
        statusElement.className = 'score-status high';
        scoreElement.style.color = 'var(--success)';
      } else if (result.repaymentProbability > 0.5) {
        statusElement.innerText = 'Moderate Risk - Manual Review';
        statusElement.className = 'score-status medium';
        scoreElement.style.color = 'var(--warning)';
      } else {
        statusElement.innerText = 'High Risk - Rejected';
        statusElement.className = 'score-status low';
        scoreElement.style.color = 'var(--danger)';
      }
      
    } catch (error) {
      console.error('Error predicting loan:', error);
      document.getElementById('credit-status').innerText = 'Error connecting to API';
    }
  });
}

// 3. Fraud Alerts
async function fetchFraudAlerts() {
  const fraudList = document.getElementById('fraud-list');
  fraudList.innerHTML = '<p class="loading-text">Scanning for anomalies...</p>';
  
  try {
    const response = await fetch('http://localhost:8080/api/fintech/fraud-alerts');
    const alerts = await response.json();
    
    fraudList.innerHTML = '';
    
    if (alerts.length === 0) {
      fraudList.innerHTML = '<p style="color:var(--success); font-size: 0.9rem;">No anomalies detected.</p>';
      return;
    }
    
    alerts.forEach(alert => {
      const item = document.createElement('div');
      item.className = 'fraud-item';
      item.innerHTML = `
        <div class="fraud-item-title">${alert.anomalyType}</div>
        <div class="fraud-item-desc">Tx ID: ${alert.transactionId} | Amount: $${alert.amount} | Risk Score: ${alert.riskScore.toFixed(2)}</div>
      `;
      fraudList.appendChild(item);
    });
    
  } catch (error) {
    console.error('Error fetching fraud alerts:', error);
    fraudList.innerHTML = '<p style="color:var(--danger); font-size: 0.9rem;">Failed to fetch alerts.</p>';
  }
}

document.getElementById('refresh-fraud').addEventListener('click', fetchFraudAlerts);

// 4. Automated Bank Report (Groq LLM)
function setupBankReportGenerator() {
  const btn = document.getElementById('generate-report-btn');
  const output = document.getElementById('report-output');
  
  btn.addEventListener('click', async () => {
    btn.innerText = 'Generating...';
    btn.disabled = true;
    output.classList.remove('hidden');
    output.innerText = 'AI is analyzing financial data...';
    
    try {
      const response = await fetch('http://localhost:8080/api/fintech/bank-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           businessName: "My Business",
           annualRevenue: 500000,
           loanAmount: 50000,
           existingDebt: 10000,
           fraudAlertCount: 0,
           latestCreditScore: null
        })
      });
      
      const result = await response.json();
      output.innerText = result.reportContent;
      
    } catch (error) {
      console.error('Error generating report:', error);
      output.innerText = 'Error generating report. Ensure backend is running.';
    } finally {
      btn.innerText = 'Generate Financial Report';
      btn.disabled = false;
    }
  });
}
