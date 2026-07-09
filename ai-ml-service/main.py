"""
main.py — AI Analytics ML Microservice Entry Point
Runs on port 8001. Deployed on Railway as a standalone service.

This is the production-ready entrypoint for the ai-ml-service Railway service.
It contains the full OHLCV analysis + LSTM-style prediction + SME demand forecast logic.

Called by AiDashboardServiceImpl.java in the Spring Boot backend via:
  ${AI_ML_SERVICE_URL}/ai-ml/analysis/{symbol}
  ${AI_ML_SERVICE_URL}/ai-ml/demand/{symbol}
"""

import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
import uvicorn
import yfinance as yf
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from sklearn.preprocessing import MinMaxScaler

# ─── Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ai_ml_service")

# ─── FastAPI App ───
app = FastAPI(
    title="PredictIQ AI Analytics ML Service",
    description="LSTM-style price prediction and SME demand forecasting for the AI Analytics Dashboard",
    version="1.0.0",
)

# ─── CORS ───
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

# ─── Timeframe → yfinance period/interval mapping ───
TF_MAP = {
    "1W": ("5d",  "1d"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y",  "1d"),
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
#  ML HELPERS
# ════════════════════════════════════════════════════════

def _lstm_predict(close_prices: np.ndarray, n_pred: int = 30) -> np.ndarray:
    """
    Lightweight LSTM-inspired prediction using:
    - MinMaxScaler normalisation
    - Exponentially-weighted moving average (EWM) for momentum
    - Linear trend component with exponential damping
    - Small Gaussian noise for realistic jitter

    No TensorFlow required — starts instantly on Railway.
    Returns shape (n_pred,) with predicted prices in original scale.
    """
    if len(close_prices) < 10:
        return np.full(n_pred, float(close_prices[-1]) if len(close_prices) > 0 else 100.0)

    prices = close_prices.astype(float)
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(prices.reshape(-1, 1)).flatten()

    span = min(14, max(2, len(scaled) // 2))
    ewm  = pd.Series(scaled).ewm(span=span).mean().values

    slope_period = min(10, max(1, len(ewm) - 1))
    slope        = (ewm[-1] - ewm[-slope_period]) / slope_period

    preds_scaled = []
    current = float(ewm[-1])
    for i in range(n_pred):
        dampen  = float(np.exp(-0.05 * i))
        noise   = float(np.random.normal(0, 0.004))
        current = float(np.clip(current + slope * dampen + noise, 0.0, 1.0))
        preds_scaled.append(current)

    preds_arr = np.array(preds_scaled, dtype=float).reshape(-1, 1)
    return scaler.inverse_transform(preds_arr).flatten()


def _future_trading_days(start: datetime, n: int) -> list[datetime]:
    """Generates n future Mon-Fri trading dates starting after 'start'."""
    dates, current = [], start
    while len(dates) < n:
        current += timedelta(days=1)
        if current.weekday() < 5:
            dates.append(current)
    return dates


def _safe_float(obj, attr: str, default=None):
    """Safely reads an attribute from fast_info or a dict."""
    try:
        v = getattr(obj, attr, None) if not isinstance(obj, dict) else obj.get(attr)
        return round(float(v), 4) if v is not None else default
    except Exception:
        return default


# ════════════════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════════════════

@app.get("/ai-ml/health", tags=["System"])
async def health() -> dict[str, str]:
    """Health check — Railway uses this to verify the service is up."""
    return {
        "status":  "ready",
        "service": "PredictIQ AI Analytics ML Service",
        "version": "1.0.0",
    }


@app.get("/ai-ml/analysis/{symbol}", tags=["Analysis"],
         summary="OHLCV history + LSTM 30-day price prediction")
async def get_market_analysis(
    symbol: str = Path(..., min_length=1, max_length=10,
                        description="Stock ticker, e.g. AAPL"),
    timeframe: str = Query("1M", description="1W | 1M | 3M | 6M | 1Y"),
) -> dict[str, Any]:
    """
    Returns:
    - Historical OHLCV array for TradingView candlestick chart
    - 30-day LSTM-style price predictions for the dashed line overlay
    - KPI metadata: currentPrice, changePercent, confidence, predictedPrice
    """
    symbol = symbol.upper().strip()
    if symbol not in SUPPORTED_SYMBOLS:
        raise HTTPException(400, f"Symbol '{symbol}' not supported. Use: {sorted(SUPPORTED_SYMBOLS)}")

    tf = timeframe.upper().strip()
    period, interval = TF_MAP.get(tf, TF_MAP["1M"])

    logger.info(f"[analysis] {symbol} [{tf}]")
    try:
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period=period, interval=interval)
        info   = ticker.fast_info if hasattr(ticker, "fast_info") else {}

        if hist.empty:
            raise ValueError("No data from yfinance")

        hist = hist.dropna(subset=["Open", "High", "Low", "Close", "Volume"])

        # Build OHLCV list
        ohlcv = [
            {
                "date":   idx.strftime("%Y-%m-%d"),
                "open":   round(float(row["Open"]),  4),
                "high":   round(float(row["High"]),  4),
                "low":    round(float(row["Low"]),   4),
                "close":  round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            }
            for idx, row in hist.iterrows()
        ]

        close_prices   = hist["Close"].values
        current_price  = float(close_prices[-1])
        prev_close     = float(close_prices[-2]) if len(close_prices) >= 2 else current_price
        change_pct     = round(((current_price - prev_close) / prev_close) * 100, 4) if prev_close else 0.0

        # Predictions
        pred_prices  = _lstm_predict(close_prices, 30)
        last_dt      = hist.index[-1].to_pydatetime()
        future_dates = _future_trading_days(last_dt, 30)
        predictions  = [
            {"date": d.strftime("%Y-%m-%d"), "price": round(float(p), 4)}
            for d, p in zip(future_dates, pred_prices)
        ]

        # Confidence: lower volatility → higher confidence
        returns    = np.diff(close_prices) / np.where(close_prices[:-1] != 0, close_prices[:-1], 1)
        volatility = float(np.std(returns)) if len(returns) > 1 else 0.02
        confidence = int(max(35, min(92, round(100 - volatility * 500))))

        return {
            "symbol":         symbol,
            "companyName":    COMPANY_NAMES.get(symbol, symbol),
            "currentPrice":   round(current_price, 4),
            "changePercent":  change_pct,
            "open":           _safe_float(info, "open")       or round(float(hist["Open"].iloc[-1]),  4),
            "high":           _safe_float(info, "high")       or round(float(hist["High"].iloc[-1]),  4),
            "low":            _safe_float(info, "low")        or round(float(hist["Low"].iloc[-1]),   4),
            "volume":         int(hist["Volume"].iloc[-1]),
            "marketCap":      _safe_float(info, "market_cap"),
            "peRatio":        None,
            "confidence":     confidence,
            "predictedPrice": round(float(pred_prices[-1]), 4) if len(pred_prices) > 0 else current_price,
            "ohlcv":          ohlcv,
            "predictions":    predictions,
        }

    except Exception as exc:
        logger.exception(f"[analysis] Error for {symbol}: {exc}")
        raise HTTPException(500, f"Analysis failed: {exc}")


@app.get("/ai-ml/demand/{symbol}", tags=["Demand"],
         summary="SME demand forecast via volume trend (30-day)")
async def get_demand_forecast(
    symbol: str = Path(..., min_length=1, max_length=10,
                        description="Stock ticker, e.g. AAPL"),
) -> dict[str, Any]:
    """
    Uses 3-month trading volume as a market-demand proxy and applies
    exponential smoothing to forecast the next 30 trading days.

    Returns:
    - historical: [{date, demand(0-100)}]  → histogram bars
    - forecast:   [{date, demand(0-100)}]  → dashed line
    - trend, peakDemand, avgDemand, outlook
    """
    symbol = symbol.upper().strip()
    if symbol not in SUPPORTED_SYMBOLS:
        raise HTTPException(400, f"Symbol '{symbol}' not supported.")

    logger.info(f"[demand] {symbol}")
    try:
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period="3mo", interval="1d").dropna(subset=["Volume"])

        if hist.empty:
            raise ValueError("No volume data from yfinance")

        volumes  = hist["Volume"].values.astype(float)
        avg_vol  = float(np.mean(volumes))
        peak_vol = float(np.max(volumes))
        vmin, vmax = volumes.min(), volumes.max()

        # Normalise to 0–100 demand index
        if vmax > vmin:
            demand_idx = ((volumes - vmin) / (vmax - vmin) * 100).round(2)
        else:
            demand_idx = np.full_like(volumes, 50.0)

        historical = [
            {"date": idx.strftime("%Y-%m-%d"), "demand": round(float(val), 2)}
            for idx, val in zip(hist.index, demand_idx)
        ]

        # Trend: compare last 5 vs previous 5 days
        recent_5  = float(np.mean(demand_idx[-5:]))  if len(demand_idx) >= 5  else float(demand_idx[-1])
        earlier_5 = float(np.mean(demand_idx[-10:-5])) if len(demand_idx) >= 10 else recent_5
        slope     = (recent_5 - earlier_5) / 5.0

        # Exponential smoothing forecast (alpha=0.3)
        alpha    = 0.3
        smoothed = float(demand_idx[-1])
        last_dt  = hist.index[-1].to_pydatetime()
        futures  = _future_trading_days(last_dt, 30)

        forecast = []
        for i, d in enumerate(futures):
            noise    = float(np.random.normal(0, 1.2))
            damped   = slope * float(np.exp(-0.03 * i))
            smoothed = float(np.clip(
                alpha * (smoothed + damped) + (1 - alpha) * smoothed + noise,
                0, 100
            ))
            forecast.append({"date": d.strftime("%Y-%m-%d"), "demand": round(smoothed, 2)})

        if slope > 0.5:
            trend, outlook = "Rising ↑", "Bullish"
        elif slope < -0.5:
            trend, outlook = "Declining ↓", "Bearish"
        else:
            trend, outlook = "Sideways →", "Neutral"

        return {
            "symbol":     symbol,
            "trend":      trend,
            "peakDemand": round(peak_vol, 0),
            "avgDemand":  round(avg_vol, 0),
            "outlook":    outlook,
            "historical": historical,
            "forecast":   forecast,
        }

    except Exception as exc:
        logger.exception(f"[demand] Error for {symbol}: {exc}")
        raise HTTPException(500, f"Demand forecast failed: {exc}")


# ─── Entry Point ───
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))   # Railway injects $PORT automatically
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
        workers=1,
    )
