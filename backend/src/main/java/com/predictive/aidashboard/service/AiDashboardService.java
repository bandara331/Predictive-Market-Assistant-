package com.predictive.aidashboard.service;

import java.util.List;
import java.util.Map;

/**
 * AiDashboardService — Service interface for the AI Analytics add-on module.
 *
 * OOP Design: Interface-based abstraction (Polymorphism). Defines the contract
 * for the module's business logic. The concrete implementation is in
 * AiDashboardServiceImpl, which is injected at runtime via Spring's IoC.
 *
 * Completely isolated from the existing StockService and UserService interfaces.
 */
public interface AiDashboardService {

    /**
     * Retrieves comprehensive market analysis for a stock symbol,
     * including current price, historical OHLCV, and LSTM predictions.
     * Proxies to the new Python ML service on port 8001.
     *
     * @param symbol    the stock ticker (e.g., AAPL)
     * @param timeframe the data window (1W, 1M, 3M, 6M, 1Y)
     * @return map containing ohlcv[], predictions[], currentPrice, confidence, etc.
     */
    Map<String, Object> getMarketAnalysis(String symbol, String timeframe);

    /**
     * Retrieves SME demand forecasting data for a stock symbol.
     * Uses the volume trend of the stock as a proxy for market demand,
     * with a 30-day rolling average forecast.
     *
     * @param symbol the stock ticker
     * @return map containing historical demand[], forecast demand[], trend, outlook
     */
    Map<String, Object> getDemandForecast(String symbol);

    /**
     * Sends a user message to Groq API with stock market context, stores the
     * interaction in the ai_insight_logs table, and returns the AI response.
     *
     * @param userEmail authenticated user's email (for audit logging)
     * @param symbol    current stock context
     * @param message   user's chat message
     * @param history   conversation history for multi-turn context
     * @return map containing "reply" (AI response) and "model" used
     */
    Map<String, Object> getChatInsight(String userEmail, String symbol, String message,
                                        List<Map<String, String>> history);

    /**
     * Retrieves the 20 most recent AI insight interactions for the authenticated user.
     *
     * @param userEmail authenticated user's email
     * @return list of insight log maps
     */
    List<Map<String, Object>> getInsightHistory(String userEmail);
}
