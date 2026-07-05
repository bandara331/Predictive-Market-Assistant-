"""
predictor.py — End-to-end LSTM stock price predictor.
Handles data preprocessing, model training/loading, and inference.
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from datetime import datetime, timedelta
import logging
import os

from data.stock_fetcher import StockFetcher
from model.lstm_model import LSTMModel

logger = logging.getLogger(__name__)

SEQUENCE_LENGTH  = 60    # Look back 60 trading days
PREDICTION_DAYS  = 30    # Predict next 30 trading days
MODELS_DIR       = os.path.join(os.path.dirname(__file__), "..", "saved_models")
os.makedirs(MODELS_DIR, exist_ok=True)


class StockPredictor:
    """
    End-to-end predictor: fetch → preprocess → train/load → predict → postprocess.

    OOP Design:
      - Encapsulates all LSTM prediction logic
      - Composes StockFetcher and LSTMModel (composition over inheritance)
      - Caches trained models per symbol on disk
    """

    def __init__(self):
        self.fetcher = StockFetcher()
        self._scalers: dict[str, MinMaxScaler] = {}
        self._models:  dict[str, LSTMModel]   = {}

    def predict(self, symbol: str, prediction_days: int = PREDICTION_DAYS) -> dict:
        """
        Main entry point. Returns a dict:
        {
          "symbol":     str,
          "prices":     [{"timestamp": int, "price": float}, ...],
          "confidence": int   (0-100)
        }
        """
        logger.info(f"Running prediction for {symbol}")
        try:
            # 1. Fetch historical data
            df = self.fetcher.fetch(symbol, period_days=730)  # ~2 years

            # 2. Preprocess
            X_train, y_train, scaler = self._preprocess(df)
            self._scalers[symbol] = scaler

            # 3. Train or load model
            model = self._get_model(symbol, X_train, y_train)
            self._models[symbol] = model

            # 4. Generate future predictions
            predicted_prices = self._forecast(df, model, scaler, prediction_days)

            # 5. Compute confidence (based on recent MAE vs price range)
            confidence = self._compute_confidence(df, model, X_train, scaler)

            # 6. Format as timestamp-price pairs
            prices = self._to_timestamped(predicted_prices, start_from=df.index[-1])

            return {"symbol": symbol, "prices": prices, "confidence": confidence}

        except Exception as e:
            logger.error(f"Prediction error for {symbol}: {e}", exc_info=True)
            raise

    # ─── Private Methods ─────────────────────────────────────────

    def _preprocess(self, df: pd.DataFrame):
        """Normalize close prices and create supervised sequences."""
        close = df["Close"].values.reshape(-1, 1)
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled = scaler.fit_transform(close)

        X, y = [], []
        for i in range(SEQUENCE_LENGTH, len(scaled)):
            X.append(scaled[i - SEQUENCE_LENGTH: i, 0])
            y.append(scaled[i, 0])

        X = np.array(X).reshape(-1, SEQUENCE_LENGTH, 1)
        y = np.array(y)
        return X, y, scaler

    def _get_model(self, symbol: str, X_train: np.ndarray, y_train: np.ndarray) -> LSTMModel:
        """Load existing model from disk or train a new one."""
        model_path = os.path.join(MODELS_DIR, f"{symbol}_lstm.keras")
        model = LSTMModel(sequence_length=SEQUENCE_LENGTH, features=1)

        if os.path.exists(model_path):
            logger.info(f"Loading cached model for {symbol}")
            model.load(model_path)
        else:
            logger.info(f"Training new model for {symbol} ({len(X_train)} samples)")
            model.build()
            model.train(X_train, y_train, epochs=50, batch_size=32)
            model.save(model_path)

        return model

    def _forecast(
        self,
        df: pd.DataFrame,
        model: LSTMModel,
        scaler: MinMaxScaler,
        days: int
    ) -> list[float]:
        """
        Autoregressive forecasting: feed each predicted price back as input
        for the next prediction (sliding window).
        """
        close = df["Close"].values.reshape(-1, 1)
        scaled = scaler.transform(close)

        # Seed with last SEQUENCE_LENGTH data points
        last_sequence = scaled[-SEQUENCE_LENGTH:].flatten().tolist()
        predictions_scaled = []

        for _ in range(days + 10):  # +10 buffer for weekends
            x = np.array(last_sequence[-SEQUENCE_LENGTH:]).reshape(1, SEQUENCE_LENGTH, 1)
            pred = model.predict(x)[0][0]
            predictions_scaled.append(pred)
            last_sequence.append(pred)

        predictions = scaler.inverse_transform(
            np.array(predictions_scaled).reshape(-1, 1)
        ).flatten().tolist()

        return predictions[:days]

    def _compute_confidence(
        self,
        df: pd.DataFrame,
        model: LSTMModel,
        X_train: np.ndarray,
        scaler: MinMaxScaler,
    ) -> int:
        """Estimate prediction confidence based on validation MAE vs price range."""
        try:
            preds_scaled = model.predict(X_train[-20:])
            preds = scaler.inverse_transform(preds_scaled).flatten()
            actuals = df["Close"].values[-20:]
            mae = np.mean(np.abs(preds - actuals))
            price_range = actuals.max() - actuals.min()
            rel_error = mae / (price_range + 1e-9)
            confidence = max(50, min(95, int(100 - rel_error * 300)))
            return confidence
        except Exception:
            return 72  # Default confidence

    def _to_timestamped(self, prices: list[float], start_from: pd.Timestamp) -> list[dict]:
        """Convert flat price list to {timestamp, price} list, skipping weekends."""
        result = []
        current_date = start_from.to_pydatetime()
        for price in prices:
            current_date += timedelta(days=1)
            while current_date.weekday() >= 5:  # skip Sat/Sun
                current_date += timedelta(days=1)
            ts = int(current_date.timestamp())
            result.append({"timestamp": ts, "price": round(price, 2)})
        return result
