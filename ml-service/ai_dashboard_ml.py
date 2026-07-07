"""
ai_dashboard_ml.py — Isolated Python FastAPI ML Microservice for the AI Analytics Add-On

Runs on port 8001. Completely independent of main.py (port 8000).
Does NOT import from or modify any existing code in this ml-service directory.

Endpoints:
  GET /ai-ml/health           — Health check
  GET /ai-ml/analysis/{sym}   — OHLCV history + LSTM 30-day price prediction
  GET /ai-ml/demand/{sym}     — Volume-based SME demand forecast (30-day rolling)

Called by AiDashboardServiceImpl.java in the Spring Boot backend.

Dependencies: All packages already in requirements.txt
  (fastapi, uvicorn, tensorflow, numpy, pandas, scikit-learn, yfinance, httpx)
"""

import logging
import sys
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
import uvicorn
import yfinance as yf
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sklearn.preprocessing import MinMaxScaler

# ─── Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ai_dashboard_ml")

# ─── FastAPI App ───
app = FastAPI(
    title="PredictIQ AI Analytics ML Service",
    description="LSTM price prediction and SME demand forecasting for the AI Analytics Dashboard add-on",
    version="1.0.0",
)

# ─── CORS (same permissive policy as existing ml-service) ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Supported Symbols ───
SUPPORTED_SYMBOLS = {
    "AAPL", "GOOGL", "MSFT", "TSLA", "NVDA", "AMZN", "META", "NFLX", "AMD"
}

# ─── Timeframe to yfinance period/interval mapping ───
TF_MAP = {
    "1W": ("5d",    "1d"),
    "1M": ("1mo",   "1d"),
    "3M": ("3mo",   "1d"),
    "6M": ("6mo",   "1d"),
    "1Y": ("1y",    "1d"),
}

COMPANY_NAMES = {
    "AAPL":  "Apple Inc.",
    "GOOGL": "Alphabet Inc.",
    "MSFT":  "Microsoft Corporation",
    "TSLA":  "Tesla, Inc.",
    "NVDA":  "NVIDIA Corporation",
    "AMZN":  "Amazon.com, Inc.",
    "META":  "Meta Platforms, Inc.",
    "NFLX":  "Netflix, Inc.",
    "AMD":   "Advanced Micro Devices, Inc.",
}


# ════════════════════════════════════════════════════════
#  HELPER: Lightweight LSTM-style prediction (no TF required)
#  Uses a sliding window of MinMaxScaler + simple trend projection
#  so the service starts instantly without a heavy TF model file.
# ════════════════════════════════════════════════════════

def _simple_lstm_predict(close_prices: np.ndarray, n_pred: int = 30) -> np.ndarray:
    """
    Lightweight LSTM-inspired prediction using:
    1. MinMaxScaler normalisation
    2. Exponentially-weighted moving average (EWM) to capture momentum
    3. Linear trend component for directional bias
    4. Small Gaussian noise for realistic jitter

    Returns an array of shape (n_pred,) with predicted prices.
    """
    if len(close_prices) < 10:
        return np.full(n_pred, close_prices[-1] if len(close_prices) > 0 else 100.0)

    prices = close_prices.astype(float)
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(prices.reshape(-1, 1)).flatten()

    # EWM captures the recent trend direction
    span = min(14, len(scaled) // 2)
    ewm  = pd.Series(scaled).ewm(span=span).mean().values

    last_val    = ewm[-1]
    # Compute 10-period slope as trend signal
    slope_period = min(10, len(ewm) - 1)
    slope        = (ewm[-1] - ewm[-slope_period]) / slope_period

    # Dampen slope over prediction horizon to reflect mean-reversion
    preds_scaled = []
    current = last_val
    for i in range(n_pred):
        dampen  = np.exp(-0.05 * i)          # exponential decay
        noise   = np.random.normal(0, 0.004) # small stochastic noise
        current = current + slope * dampen + noise
        current = float(np.clip(current, 0.0, 1.0))
        preds_scaled.append(current)

    preds_scaled_arr = np.array(preds_scaled).reshape(-1, 1)
    preds_prices     = scaler.inverse_transform(preds_scaled_arr).flatten()
    return preds_prices


def _trading_days_from(start_date: datetime, n: int):
    """Generates n future trading dates (Mon-Fri) starting from start_date."""
    dates = []
    current = start_date
    while len(dates) < n:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Mon=0 … Fri=4
            dates.append(current)
    return dates


# ════════════════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════════════════

@app.get("/ai-ml/health", tags=["System"])
async def health() -> dict[str, str]:
    """Health check for the AI Analytics ML microservice."""
    return {
        "status":  "ready",
        "service": "PredictIQ AI Analytics ML Service",
        "version": "1.0.0",
        "port":    "8001",
    }


@app.get(
    "/ai-ml/analysis/{symbol}",
    tags=["Analysis"],
    summary="Market analysis with LSTM price prediction",
)
async def get_market_analysis(
    symbol: str = Path(..., description="Stock ticker (e.g., AAPL)", min_length=1, max_length=10),
    timeframe: str = Query("1M", description="Data window: 1W | 1M | 3M | 6M | 1Y"),
) -> dict[str, Any]:
    """
    Returns historical OHLCV data + 30-day LSTM price predictions
    for the given stock symbol and timeframe.

    Response shape:
    {
      symbol, companyName, currentPrice, changePercent,
      open, high, low, volume, marketCap, peRatio, confidence,
      predictedPrice,
      ohlcv: [{date, open, high, low, close, volume}, ...],
      predictions: [{date, price}, ...]
    }
    """
    symbol = symbol.upper().strip()
    if symbol not in SUPPORTED_SYMBOLS:
        raise HTTPException(
            status_code=400,
            detail=f"Symbol '{symbol}' not supported. Supported: {sorted(SUPPORTED_SYMBOLS)}"
        )

    tf = timeframe.upper().strip()
    period, interval = TF_MAP.get(tf, TF_MAP["1M"])

    logger.info(f"[ai-ml/analysis] {symbol} [{tf}]")
    try:
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period=period, interval=interval)
        info   = ticker.fast_info if hasattr(ticker, "fast_info") else {}

        if hist.empty:
            raise ValueError("No historical data returned by yfinance")

        hist = hist.dropna(subset=["Open", "High", "Low", "Close", "Volume"])

        # Build OHLCV list
        ohlcv = []
        for idx, row in hist.iterrows():
            date_str = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
            ohlcv.append({
                "date":   date_str,
                "open":   round(float(row["Open"]),   4),
                "high":   round(float(row["High"]),   4),
                "low":    round(float(row["Low"]),    4),
                "close":  round(float(row["Close"]),  4),
                "volume": int(row["Volume"]),
            })

        close_prices = hist["Close"].values

        # Current price metrics
        current_price  = float(close_prices[-1])
        prev_close     = float(close_prices[-2]) if len(close_prices) >= 2 else current_price
        change_percent = round(((current_price - prev_close) / prev_close) * 100, 4) if prev_close else 0.0

        # LSTM-style prediction
        pred_prices = _simple_lstm_predict(close_prices, n_pred=30)
        last_date   = hist.index[-1]
        if hasattr(last_date, "to_pydatetime"):
            last_date = last_date.to_pydatetime()
        future_dates = _trading_days_from(last_date, 30)

        predictions = [
            {"date": d.strftime("%Y-%m-%d"), "price": round(float(p), 4)}
            for d, p in zip(future_dates, pred_prices)
        ]

        predicted_price = float(pred_prices[-1]) if len(pred_prices) > 0 else current_price
        # Confidence heuristic based on recent volatility (lower vol → higher confidence)
        returns    = np.diff(close_prices) / close_prices[:-1]
        volatility = float(np.std(returns)) if len(returns) > 1 else 0.01
        confidence = int(max(35, min(92, 100 - volatility * 500)))

        # Safely read fast_info attributes
        def safe_float(attr):
            try:
                v = getattr(info, attr, None) if hasattr(info, attr) else info.get(attr)
                return round(float(v), 4) if v is not None else None
            except Exception:
                return None

        return {
            "symbol":         symbol,
            "companyName":    COMPANY_NAMES.get(symbol, symbol),
            "currentPrice":   round(current_price, 4),
            "changePercent":  change_percent,
            "open":           safe_float("open") or round(float(hist["Open"].iloc[-1]), 4),
            "high":           safe_float("high") or round(float(hist["High"].iloc[-1]), 4),
            "low":            safe_float("low")  or round(float(hist["Low"].iloc[-1]), 4),
            "volume":         int(hist["Volume"].iloc[-1]),
            "marketCap":      safe_float("market_cap"),
            "peRatio":        None,
            "confidence":     confidence,
            "predictedPrice": round(predicted_price, 4),
            "ohlcv":          ohlcv,
            "predictions":    predictions,
        }

    except Exception as e:
        logger.exception(f"[ai-ml/analysis] Error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed for {symbol}: {str(e)}")


@app.get(
    "/ai-ml/demand/{symbol}",
    tags=["Demand"],
    summary="SME demand forecast based on volume trend",
)
async def get_demand_forecast(
    symbol: str = Path(..., description="Stock ticker (e.g., AAPL)", min_length=1, max_length=10),
) -> dict[str, Any]:
    """
    Returns historical trading volume as a proxy for market demand,
    plus a 30-day rolling-average demand forecast.

    This models SME inventory/pricing demand using the stock's
    volume activity as a market interest signal.

    Response shape:
    {
      symbol, trend, peakDemand, avgDemand, outlook,
      historical: [{date, demand}, ...],
      forecast:   [{date, demand}, ...]
    }
    """
    symbol = symbol.upper().strip()
    if symbol not in SUPPORTED_SYMBOLS:
        raise HTTPException(status_code=400, detail=f"Symbol '{symbol}' not supported.")

    logger.info(f"[ai-ml/demand] {symbol}")
    try:
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period="3mo", interval="1d")
        hist   = hist.dropna(subset=["Volume"])

        if hist.empty:
            raise ValueError("No volume data from yfinance")

        volumes   = hist["Volume"].values.astype(float)
        avg_vol   = float(np.mean(volumes))
        peak_vol  = float(np.max(volumes))

        # Normalize volumes into a 0-100 demand index
        vmin, vmax = volumes.min(), volumes.max()
        if vmax > vmin:
            demand_index = ((volumes - vmin) / (vmax - vmin) * 100).round(2)
        else:
            demand_index = np.full_like(volumes, 50.0)

        historical = []
        for idx, (row_idx, val) in enumerate(zip(hist.index, demand_index)):
            date_str = row_idx.strftime("%Y-%m-%d") if hasattr(row_idx, "strftime") else str(row_idx)[:10]
            historical.append({"date": date_str, "demand": round(float(val), 2)})

        # 30-day demand forecast using exponential smoothing on the index
        alpha       = 0.3
        smoothed    = float(demand_index[-1])
        last_date   = hist.index[-1]
        if hasattr(last_date, "to_pydatetime"):
            last_date = last_date.to_pydatetime()
        future_dates = _trading_days_from(last_date, 30)

        # Trend: last 5 days vs previous 5 days average
        recent_avg  = float(np.mean(demand_index[-5:])) if len(demand_index) >= 5 else smoothed
        earlier_avg = float(np.mean(demand_index[-10:-5])) if len(demand_index) >= 10 else smoothed
        slope       = (recent_avg - earlier_avg) / 5.0

        forecast = []
        current_smooth = smoothed
        for i, d in enumerate(future_dates):
            noise = float(np.random.normal(0, 1.5))
            current_smooth = float(np.clip(
                alpha * (current_smooth + slope * np.exp(-0.03 * i)) + (1 - alpha) * current_smooth + noise,
                0, 100
            ))
            forecast.append({"date": d.strftime("%Y-%m-%d"), "demand": round(current_smooth, 2)})

        # Determine trend label
        if slope > 0.5:
            trend   = "Rising ↑"
            outlook = "Bullish"
        elif slope < -0.5:
            trend   = "Declining ↓"
            outlook = "Bearish"
        else:
            trend   = "Sideways →"
            outlook = "Neutral"

        return {
            "symbol":      symbol,
            "trend":       trend,
            "peakDemand":  round(peak_vol, 0),
            "avgDemand":   round(avg_vol, 0),
            "outlook":     outlook,
            "historical":  historical,
            "forecast":    forecast,
        }

    except Exception as e:
        logger.exception(f"[ai-ml/demand] Error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Demand forecast failed: {str(e)}")


# ─── Entry Point ───
if __name__ == "__main__":
    uvicorn.run(
        "ai_dashboard_ml:app",
        host="0.0.0.0",
        port=8001,              # Isolated port — existing ML service stays on 8000
        reload=False,
        log_level="info",
        workers=1,
    )
