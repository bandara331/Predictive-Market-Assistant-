package com.predictive.service;

import com.predictive.dto.StockDataDTO;

import java.util.Map;

/**
 * StockService — Interface for stock data retrieval and ML integration.
 * Demonstrates OOP Polymorphism (interface-based design).
 */
public interface StockService {

    /** Returns historical OHLCV data for a symbol within the given timeframe */
    StockDataDTO getHistoricalData(String symbol, String timeframe);

    /** Proxies prediction request to ML microservice */
    Map<String, Object> getPredictions(String symbol);

    /** Proxies chat request to Groq API with stock context */
    Map<String, Object> getChatResponse(String message, String symbol, Object history);
}
