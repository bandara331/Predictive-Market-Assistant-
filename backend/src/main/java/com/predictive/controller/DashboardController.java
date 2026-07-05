package com.predictive.controller;

import com.predictive.dto.StockDataDTO;
import com.predictive.service.StockService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * DashboardController — Protected REST controller for dashboard data.
 * All endpoints require a valid JWT (enforced by SecurityConfig).
 *
 * Endpoints:
 *   GET  /api/dashboard/stocks/{symbol}         — Historical OHLCV data
 *   GET  /api/dashboard/predict/{symbol}        — LSTM price predictions
 *   POST /api/dashboard/chat                    — Groq AI chat response
 */
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Slf4j
public class DashboardController {

    private final StockService stockService;

    /* ─── Historical Stock Data ─── */
    @GetMapping("/stocks/{symbol}")
    public ResponseEntity<StockDataDTO> getHistoricalData(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1M") String timeframe,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("Stock data request: {} [{}] by {}", symbol, timeframe, userDetails.getUsername());
        StockDataDTO data = stockService.getHistoricalData(symbol.toUpperCase(), timeframe);
        return ResponseEntity.ok(data);
    }

    /* ─── LSTM Predictions ─── */
    @GetMapping("/predict/{symbol}")
    public ResponseEntity<Map<String, Object>> getPredictions(
            @PathVariable String symbol,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("Prediction request: {} by {}", symbol, userDetails.getUsername());
        Map<String, Object> predictions = stockService.getPredictions(symbol.toUpperCase());
        return ResponseEntity.ok(predictions);
    }

    /* ─── AI Chat (Groq) ─── */
    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String message = (String) body.getOrDefault("message", "");
        String symbol  = (String) body.getOrDefault("symbol", "AAPL");
        Object history = body.get("history");

        log.info("Chat request from {} for symbol {}", userDetails.getUsername(), symbol);
        Map<String, Object> response = stockService.getChatResponse(message, symbol, history);
        return ResponseEntity.ok(response);
    }

    /* ─── Health Check ─── */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "PredictIQ Dashboard API"));
    }
}
