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
