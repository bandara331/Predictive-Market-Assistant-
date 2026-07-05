"""
stock_fetcher.py — yfinance wrapper for fetching OHLCV stock data.
Handles timezone normalization and weekend filtering.
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

TIMEFRAME_MAP = {
    "1W": 7,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
}


class StockFetcher:
    """
    Wraps yfinance to provide clean OHLCV DataFrames.
    Demonstrates OOP encapsulation — all yfinance logic is isolated here.
    """

    def __init__(self, cache_timeout_minutes: int = 15):
        self._cache: dict[str, tuple[pd.DataFrame, datetime]] = {}
        self._timeout = timedelta(minutes=cache_timeout_minutes)

    def fetch(self, symbol: str, period_days: int = 365) -> pd.DataFrame:
        """
        Fetch OHLCV data for a symbol over the given number of days.
        Returns DataFrame with columns: [Open, High, Low, Close, Volume]
        and DatetimeIndex in UTC.
        """
        cache_key = f"{symbol}_{period_days}"
        if cache_key in self._cache:
            df, fetched_at = self._cache[cache_key]
            if datetime.utcnow() - fetched_at < self._timeout:
                logger.debug(f"Cache hit: {cache_key}")
                return df.copy()

        end_date   = datetime.today()
        start_date = end_date - timedelta(days=period_days + 30)  # extra buffer

        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start_date.strftime("%Y-%m-%d"),
                                end=end_date.strftime("%Y-%m-%d"),
                                interval="1d",
                                auto_adjust=True)

            if df.empty:
                raise ValueError(f"No data returned for symbol: {symbol}")

            # Normalize index to UTC naive timestamps
            if df.index.tzinfo is not None:
                df.index = df.index.tz_convert("UTC").tz_localize(None)

            df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
            df = df[df.index.dayofweek < 5]  # weekdays only

            self._cache[cache_key] = (df, datetime.utcnow())
            logger.info(f"Fetched {len(df)} rows for {symbol}")
            return df.copy()

        except Exception as e:
            logger.error(f"yfinance error for {symbol}: {e}")
            raise RuntimeError(f"Could not fetch data for {symbol}: {e}")

    def get_latest_price(self, symbol: str) -> float:
        """Return the most recent closing price."""
        df = self.fetch(symbol, period_days=5)
        return float(df["Close"].iloc[-1])
