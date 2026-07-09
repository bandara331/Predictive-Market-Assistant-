"""
main.py — FastAPI ML Microservice Entry Point
Provides LSTM stock price predictions via REST API.
Runs on port 8000, called by the Spring Boot backend.
"""

import logging
import sys
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import random

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ─── Lazy import predictor to avoid TF startup delays ───
predictor = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the StockPredictor on startup."""
    global predictor
    logger.info("🚀 PredictIQ ML Service starting up...")
    try:
        from model.predictor import StockPredictor
        predictor = StockPredictor()
        logger.info("✅ StockPredictor initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize StockPredictor: {e}")
        predictor = None
    yield
    logger.info("🛑 ML Service shutting down...")


# ─── FastAPI App ───
app = FastAPI(
    title="PredictIQ ML Microservice",
    description="LSTM-powered stock price prediction API",
    version="1.0.0",
    lifespan=lifespan,
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
SUPPORTED_SYMBOLS = {"AAPL", "GOOGL", "MSFT", "TSLA", "NVDA", "AMZN",
                     "META", "NFLX", "AMD", "INTC", "BABA", "ORCL"}


# ════════════════════════════════════════════════
#  ENDPOINTS
# ════════════════════════════════════════════════

@app.get("/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    status = "ready" if predictor is not None else "initializing"
    return {"status": status, "service": "PredictIQ ML Microservice", "version": "1.0.0"}


@app.get(
    "/predict/{symbol}",
    tags=["Predictions"],
    summary="Get 30-day LSTM price prediction for a stock symbol",
    response_description="Predicted prices with timestamps and confidence score",
)
async def predict_stock(
    symbol: str = Path(..., description="Stock ticker symbol (e.g., AAPL)", min_length=1, max_length=10)
) -> dict[str, Any]:
    """
    Predict the next 30 trading days of closing prices for a given stock symbol
    using a trained TensorFlow LSTM model.

    - **symbol**: Stock ticker (e.g., AAPL, GOOGL, TSLA)

    Returns:
    ```json
    {
      "symbol": "AAPL",
      "prices": [
        {"timestamp": 1720224000, "price": 192.45},
        ...
      ],
      "confidence": 78
    }
    ```
    """
    symbol = symbol.upper().strip()

    if symbol not in SUPPORTED_SYMBOLS:
        raise HTTPException(
            status_code=400,
            detail=f"Symbol '{symbol}' not supported. Supported: {sorted(SUPPORTED_SYMBOLS)}"
        )

    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail="ML model is still initializing. Please retry in a moment."
        )

    try:
        logger.info(f"Prediction requested for {symbol}")
        result = predictor.predict(symbol, prediction_days=30)
        return JSONResponse(content=result)
    except RuntimeError as e:
        logger.error(f"Prediction failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected error for {symbol}")
        raise HTTPException(status_code=500, detail="Internal prediction error. Check server logs.")


@app.get(
    "/symbols",
    tags=["System"],
    summary="List all supported stock symbols",
)
async def list_symbols() -> dict[str, list[str]]:
    """Returns the list of supported stock ticker symbols."""
    return {"symbols": sorted(SUPPORTED_SYMBOLS)}


# ════════════════════════════════════════════════
#  FINTECH ENDPOINTS
# ════════════════════════════════════════════════

class LoanRequest(BaseModel):
    loanAmount: float
    businessRevenue: float

class DemandForecastRequest(BaseModel):
    historicalData: list[float]

@app.post("/credit-score", tags=["Fintech"])
def predict_credit_score(request: LoanRequest):
    """
    Simulates a Credit Risk Scoring model for Micro-Loans.
    """
    try:
        base_score = 650
        ratio = request.businessRevenue / (request.loanAmount + 1)
        bonus = min(200, ratio * 10)
        final_score = min(850, base_score + bonus)
        probability = (final_score - 300) / 550.0
        
        return {
            "creditScore": round(final_score),
            "repaymentProbability": round(probability, 2)
        }
    except Exception as e:
        logger.error(f"Credit score prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/detect-fraud", tags=["Fintech"])
def detect_fraud():
    """
    Simulates an Anomaly Detection model (e.g., Isolation Forest).
    """
    alerts = []
    if random.random() > 0.3:
        alerts.append({
            "anomalyType": "Unusual Transaction Volume",
            "transactionId": f"TXN-{random.randint(10000, 99999)}",
            "amount": round(random.uniform(5000, 50000), 2),
            "riskScore": round(random.uniform(0.8, 0.99), 2)
        })
    return alerts

@app.post("/predict-demand", tags=["Fintech"])
def predict_demand(request: DemandForecastRequest):
    """
    Simulates an LSTM Demand Forecasting model.
    """
    if not request.historicalData:
        raise HTTPException(status_code=400, detail="Historical data required")
    
    last_val = request.historicalData[-1]
    forecast = []
    for i in range(30):
        next_val = last_val + random.uniform(-100, 150)
        forecast.append(round(next_val, 2))
        last_val = next_val
        
    return {"forecast": forecast}

# ─── Entry Point ───
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
        workers=1,  # Single worker to share model in memory
    )
