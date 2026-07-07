package com.predictive.aidashboard.service;

import com.predictive.aidashboard.model.AiInsightLog;
import com.predictive.aidashboard.repository.AiInsightLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AiDashboardServiceImpl — Concrete implementation of AiDashboardService.
 *
 * OOP Design:
 *   - Implements AiDashboardService interface (Polymorphism)
 *   - Reuses RestTemplate bean from existing AppConfig (Dependency Injection)
 *   - Reuses Groq API properties already defined in application.properties
 *   - Adds new "ai.ml.service.url" property for the isolated ML microservice
 *
 * This class has NO modification to any existing service, config, or entity.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiDashboardServiceImpl implements AiDashboardService {

    /* ─── Injected beans (RestTemplate already defined in AppConfig) ─── */
    private final RestTemplate              restTemplate;
    private final AiInsightLogRepository    insightLogRepo;

    /* ─── Config values — reads existing properties, adds one new one ─── */
    @Value("${groq.api.key}")
    private String groqApiKey;

    @Value("${groq.api.url}")
    private String groqApiUrl;

    @Value("${groq.model:llama-3.3-70b-versatile}")
    private String groqModel;

    /** New property: URL of the new isolated Python ML service (port 8001) */
    @Value("${ai.ml.service.url:http://localhost:8001}")
    private String aiMlServiceUrl;

    /* ─── Supported symbols ─── */
    private static final Set<String> SUPPORTED = Set.of(
        "AAPL","GOOGL","MSFT","TSLA","NVDA","AMZN","META","NFLX","AMD"
    );

    /* ════════════════════════════════════════════════════════
       getMarketAnalysis — Calls new Python ML service /ai-ml/analysis/{symbol}
       ════════════════════════════════════════════════════════ */
    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> getMarketAnalysis(String symbol, String timeframe) {
        String sym = validateSymbol(symbol);
        try {
            String url = aiMlServiceUrl + "/ai-ml/analysis/" + sym + "?timeframe=" + timeframe;
            log.info("[AiDashboard] Fetching analysis for {} [{}] from {}", sym, timeframe, url);
            ResponseEntity<Map> resp = restTemplate.getForEntity(url, Map.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                return resp.getBody();
            }
        } catch (Exception e) {
            log.warn("[AiDashboard] ML service unavailable for analysis {}: {}", sym, e.getMessage());
        }
        // Fallback: return minimal stub so the UI doesn't break
        return aidFallbackAnalysis(sym);
    }

    /* ════════════════════════════════════════════════════════
       getDemandForecast — Calls new Python ML service /ai-ml/demand/{symbol}
       ════════════════════════════════════════════════════════ */
    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> getDemandForecast(String symbol) {
        String sym = validateSymbol(symbol);
        try {
            String url = aiMlServiceUrl + "/ai-ml/demand/" + sym;
            log.info("[AiDashboard] Fetching demand forecast for {} from {}", sym, url);
            ResponseEntity<Map> resp = restTemplate.getForEntity(url, Map.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                return resp.getBody();
            }
        } catch (Exception e) {
            log.warn("[AiDashboard] ML service unavailable for demand {}: {}", sym, e.getMessage());
        }
        return aidFallbackDemand(sym);
    }

    /* ════════════════════════════════════════════════════════
       getChatInsight — Calls Groq API, persists to ai_insight_logs
       ════════════════════════════════════════════════════════ */
    @Override
    public Map<String, Object> getChatInsight(String userEmail, String symbol,
                                               String message, List<Map<String, String>> history) {
        long start = System.currentTimeMillis();
        String sym = validateSymbol(symbol);

        // Build Groq request
        List<Map<String, String>> messages = new ArrayList<>();

        // System prompt with stock context
        messages.add(Map.of(
            "role", "system",
            "content", String.format(
                "You are an elite AI financial analyst and business strategy advisor. " +
                "The user is currently analyzing %s stock on the PredictIQ AI Analytics dashboard. " +
                "Provide data-driven, actionable insights. Be concise but comprehensive. " +
                "Use markdown formatting with **bold** for key metrics and figures. " +
                "When making predictions, always mention risk factors and confidence levels.",
                sym
            )
        ));

        // Append conversation history (up to last 10 turns)
        if (history != null && !history.isEmpty()) {
            int start_ = Math.max(0, history.size() - 10);
            messages.addAll(history.subList(start_, history.size()));
        }

        // Append current user message
        messages.add(Map.of("role", "user", "content", message));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model",       groqModel);
        requestBody.put("messages",    messages);
        requestBody.put("max_tokens",  1024);
        requestBody.put("temperature", 0.7);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(groqApiKey);

        String reply;
        try {
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            @SuppressWarnings("unchecked")
            ResponseEntity<Map> resp = restTemplate.exchange(groqApiUrl, HttpMethod.POST, entity, Map.class);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) resp.getBody().get("choices");
            @SuppressWarnings("unchecked")
            Map<String, Object> msgObj = (Map<String, Object>) choices.get(0).get("message");
            reply = (String) msgObj.get("content");
            log.info("[AiDashboard] Groq response received for user={} symbol={}", userEmail, sym);
        } catch (Exception e) {
            log.error("[AiDashboard] Groq API error for user={}: {}", userEmail, e.getMessage());
            reply = "⚠️ The AI assistant is temporarily unavailable. Please try again in a moment.";
        }

        long elapsed = System.currentTimeMillis() - start;

        // Persist interaction to ai_insight_logs table
        try {
            AiInsightLog logEntry = AiInsightLog.builder()
                .userEmail(userEmail)
                .symbol(sym)
                .queryText(message)
                .responseText(reply)
                .modelUsed(groqModel)
                .responseMs(elapsed)
                .build();
            insightLogRepo.save(logEntry);
        } catch (Exception e) {
            log.warn("[AiDashboard] Failed to persist insight log: {}", e.getMessage());
        }

        return Map.of(
            "reply",      reply,
            "model",      groqModel,
            "symbol",     sym,
            "responseMs", elapsed
        );
    }

    /* ════════════════════════════════════════════════════════
       getInsightHistory — Returns recent logs for the user
       ════════════════════════════════════════════════════════ */
    @Override
    public List<Map<String, Object>> getInsightHistory(String userEmail) {
        return insightLogRepo
            .findTop20ByUserEmailOrderByCreatedAtDesc(userEmail)
            .stream()
            .map(log -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id",          log.getId());
                m.put("symbol",      log.getSymbol());
                m.put("query",       log.getQueryText());
                m.put("response",    log.getResponseText());
                m.put("model",       log.getModelUsed());
                m.put("responseMs",  log.getResponseMs());
                m.put("createdAt",   log.getCreatedAt());
                return m;
            })
            .collect(Collectors.toList());
    }

    /* ─── Private Helpers ─── */

    private String validateSymbol(String symbol) {
        String sym = (symbol == null ? "AAPL" : symbol.toUpperCase().strip());
        return SUPPORTED.contains(sym) ? sym : "AAPL";
    }

    /** Minimal fallback analysis payload when the ML service is unreachable */
    private Map<String, Object> aidFallbackAnalysis(String symbol) {
        Map<String, Object> m = new HashMap<>();
        m.put("symbol",        symbol);
        m.put("ohlcv",         List.of());
        m.put("predictions",   List.of());
        m.put("currentPrice",  0);
        m.put("changePercent", 0);
        m.put("confidence",    0);
        m.put("companyName",   symbol);
        m.put("error",         "ML service unavailable — showing empty chart");
        return m;
    }

    /** Minimal fallback demand payload when the ML service is unreachable */
    private Map<String, Object> aidFallbackDemand(String symbol) {
        Map<String, Object> m = new HashMap<>();
        m.put("symbol",     symbol);
        m.put("historical", List.of());
        m.put("forecast",   List.of());
        m.put("trend",      "N/A");
        m.put("outlook",    "Neutral");
        m.put("error",      "ML service unavailable");
        return m;
    }
}
