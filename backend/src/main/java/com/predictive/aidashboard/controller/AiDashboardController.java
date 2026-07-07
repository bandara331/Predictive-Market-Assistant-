package com.predictive.aidashboard.controller;

import com.predictive.aidashboard.dto.AiDashboardChatRequest;
import com.predictive.aidashboard.service.AiDashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * AiDashboardController — REST Controller for the AI Analytics add-on module.
 *
 * OOP Design:
 *   - Follows the same RESTful pattern as the existing DashboardController
 *   - Demonstrates Dependency Injection via constructor injection (Lombok @RequiredArgsConstructor)
 *   - Encapsulation: all business logic delegated to AiDashboardService
 *
 * Base mapping: /api/ai-dashboard
 * Security: All endpoints are protected by the EXISTING JWT SecurityFilterChain
 *           (no new security config required — the existing config already
 *            requires authentication for ALL /api/** routes by default).
 *
 * Endpoints:
 *   GET  /api/ai-dashboard/health            — Health check for this module
 *   GET  /api/ai-dashboard/analysis/{symbol} — Market analysis + LSTM predictions
 *   GET  /api/ai-dashboard/demand/{symbol}   — SME demand forecasting
 *   POST /api/ai-dashboard/chat              — Groq AI chat with persistence
 *   GET  /api/ai-dashboard/history           — Recent insight logs for user
 */
@RestController
@RequestMapping("/api/ai-dashboard")
@RequiredArgsConstructor
@Slf4j
public class AiDashboardController {

    private final AiDashboardService aiDashboardService;

    /* ─── Health Check ─── */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status",  "UP",
            "module",  "AI Analytics & Finance Add-On",
            "version", "1.0.0"
        ));
    }

    /* ─── Market Analysis + LSTM Predictions ─── */
    @GetMapping("/analysis/{symbol}")
    public ResponseEntity<Map<String, Object>> getMarketAnalysis(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "1M") String timeframe,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("[AiDashboard] Analysis request: {} [{}] by {}", symbol, timeframe, userDetails.getUsername());
        Map<String, Object> data = aiDashboardService.getMarketAnalysis(symbol.toUpperCase(), timeframe);
        return ResponseEntity.ok(data);
    }

    /* ─── SME Demand Forecasting ─── */
    @GetMapping("/demand/{symbol}")
    public ResponseEntity<Map<String, Object>> getDemandForecast(
            @PathVariable String symbol,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("[AiDashboard] Demand forecast request: {} by {}", symbol, userDetails.getUsername());
        Map<String, Object> data = aiDashboardService.getDemandForecast(symbol.toUpperCase());
        return ResponseEntity.ok(data);
    }

    /* ─── Groq AI Chat ─── */
    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(
            @RequestBody AiDashboardChatRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String email  = userDetails.getUsername();
        String symbol = request.getSymbol() != null ? request.getSymbol().toUpperCase() : "AAPL";
        log.info("[AiDashboard] Chat request from {} for symbol {}", email, symbol);

        Map<String, Object> response = aiDashboardService.getChatInsight(
            email, symbol, request.getMessage(), request.getHistory()
        );
        return ResponseEntity.ok(response);
    }

    /* ─── Recent Insight History ─── */
    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        log.info("[AiDashboard] History request by {}", userDetails.getUsername());
        List<Map<String, Object>> history = aiDashboardService.getInsightHistory(userDetails.getUsername());
        return ResponseEntity.ok(history);
    }
}
