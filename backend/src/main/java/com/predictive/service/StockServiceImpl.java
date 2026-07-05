package com.predictive.service;

import com.predictive.dto.StockDataDTO;
import com.predictive.model.StockData;
import com.predictive.repository.StockDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * StockServiceImpl — Concrete implementation of StockService.
 * Demonstrates OOP Polymorphism: fulfils StockService contract.
 * Proxies ML microservice and Groq API calls.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StockServiceImpl implements StockService {

    private final StockDataRepository stockDataRepository;
    private final RestTemplate        restTemplate;

    @Value("${ml.service.url}")
    private String mlServiceUrl;

    @Value("${groq.api.key}")
    private String groqApiKey;

    @Value("${groq.api.url}")
    private String groqApiUrl;

    @Value("${groq.model}")
    private String groqModel;

    private static final Map<String, Integer> TIMEFRAME_DAYS = Map.of(
            "1W", 7, "1M", 30, "3M", 90, "6M", 180, "1Y", 365
    );

    /* ─── Historical Data ─── */
    @Override
    public StockDataDTO getHistoricalData(String symbol, String timeframe) {
        int days  = TIMEFRAME_DAYS.getOrDefault(timeframe.toUpperCase(), 30);
        LocalDate start = LocalDate.now().minusDays(days);
        LocalDate end   = LocalDate.now();

        List<StockData> dbData = stockDataRepository
                .findBySymbolAndTradeDateBetweenOrderByTradeDateAsc(symbol.toUpperCase(), start, end);

        // If no DB data, generate synthetic demo data
        if (dbData.isEmpty()) {
            log.warn("No DB data for {}. Returning synthetic demo data.", symbol);
            return generateSyntheticData(symbol, timeframe, days);
        }

        List<StockDataDTO.OhlcvBar> bars = dbData.stream()
                .map(sd -> StockDataDTO.OhlcvBar.builder()
                        .timestamp(sd.getTradeDate().atStartOfDay().toEpochSecond(ZoneOffset.UTC))
                        .open(sd.getOpenPrice())
                        .high(sd.getHighPrice())
                        .low(sd.getLowPrice())
                        .close(sd.getClosePrice())
                        .volume(sd.getVolume())
                        .build())
                .collect(Collectors.toList());

        return StockDataDTO.builder()
                .symbol(symbol)
                .timeframe(timeframe)
                .ohlcv(bars)
                .build();
    }

    /* ─── ML Predictions ─── */
    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> getPredictions(String symbol) {
        try {
            String url = mlServiceUrl + "/predict/" + symbol.toUpperCase();
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
        } catch (Exception e) {
            log.warn("ML service unavailable for {}. Returning demo predictions.", symbol);
        }
        return generateDemoPredictions(symbol);
    }

    /* ─── Groq Chat ─── */
    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> getChatResponse(String message, String symbol, Object history) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(groqApiKey);

            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content",
                    "You are an expert AI financial analyst. The user is viewing " + symbol + " stock. Provide concise, data-driven insights."));
            messages.add(Map.of("role", "user", "content", message));

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model", groqModel);
            requestBody.put("messages", messages);
            requestBody.put("max_tokens", 512);
            requestBody.put("temperature", 0.7);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(groqApiUrl, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.getBody().get("choices");
                if (choices != null && !choices.isEmpty()) {
                    Map<String, Object> msgObj = (Map<String, Object>) choices.get(0).get("message");
                    String content = (String) msgObj.get("content");
                    return Map.of("response", content, "symbol", symbol);
                }
            }
        } catch (Exception e) {
            log.error("Groq API error: {}", e.getMessage());
        }
        return Map.of("response", "AI service temporarily unavailable. Please check your Groq API key.", "symbol", symbol);
    }

    /* ─── Synthetic Demo Data ─── */
    private StockDataDTO generateSyntheticData(String symbol, String timeframe, int days) {
        Map<String, Double> seeds = Map.of(
                "AAPL", 189.0, "GOOGL", 178.0, "MSFT", 420.0,
                "TSLA", 248.0, "NVDA", 875.0, "AMZN", 195.0
        );
        Map<String, Double> vols = Map.of(
                "AAPL", 0.012, "GOOGL", 0.013, "MSFT", 0.011,
                "TSLA", 0.028, "NVDA", 0.022, "AMZN", 0.015
        );

        double price    = seeds.getOrDefault(symbol, 150.0);
        double vol      = vols.getOrDefault(symbol, 0.015);
        Random rnd      = new Random(symbol.hashCode());
        LocalDate start = LocalDate.now().minusDays(days);
        List<StockDataDTO.OhlcvBar> bars = new ArrayList<>();

        for (int i = 0; i <= days; i++) {
            LocalDate date = start.plusDays(i);
            if (date.getDayOfWeek().getValue() >= 6) continue; // skip weekends

            double change = price * vol * (rnd.nextDouble() * 2 - 1);
            double open   = price;
            double close  = Math.max(1, price + change);
            double high   = Math.max(open, close) * (1 + rnd.nextDouble() * vol * 0.5);
            double low    = Math.min(open, close) * (1 - rnd.nextDouble() * vol * 0.5);
            long   volume = (long)(20_000_000 + rnd.nextDouble() * 60_000_000);

            bars.add(StockDataDTO.OhlcvBar.builder()
                    .timestamp(date.atStartOfDay().toEpochSecond(ZoneOffset.UTC))
                    .open(BigDecimal.valueOf(round(open, 2)))
                    .high(BigDecimal.valueOf(round(high, 2)))
                    .low(BigDecimal.valueOf(round(low, 2)))
                    .close(BigDecimal.valueOf(round(close, 2)))
                    .volume(volume)
                    .build());
            price = close;
        }

        return StockDataDTO.builder().symbol(symbol).timeframe(timeframe).ohlcv(bars).build();
    }

    private Map<String, Object> generateDemoPredictions(String symbol) {
        Map<String, Double> seeds   = Map.of("AAPL", 189.0, "GOOGL", 178.0, "MSFT", 420.0, "TSLA", 248.0, "NVDA", 875.0, "AMZN", 195.0);
        Map<String, Double> trends  = Map.of("AAPL", 1.003, "GOOGL", 1.002, "MSFT", 1.004, "TSLA", 0.997, "NVDA", 1.005, "AMZN", 1.003);

        double price  = seeds.getOrDefault(symbol, 150.0);
        double trend  = trends.getOrDefault(symbol, 1.002);
        Random rnd    = new Random(symbol.hashCode() + 99);
        long now      = LocalDate.now().atStartOfDay().toEpochSecond(ZoneOffset.UTC);
        long daySec   = 86400L;
        List<Map<String, Object>> prices = new ArrayList<>();

        for (int i = 1; i <= 30; i++) {
            LocalDate date = LocalDate.now().plusDays(i);
            if (date.getDayOfWeek().getValue() >= 6) continue;
            double noise = price * 0.008 * (rnd.nextDouble() * 2 - 1);
            price = price * trend + noise;
            prices.add(Map.of("timestamp", now + (long) i * daySec, "price", round(price, 2)));
        }

        return Map.of("symbol", symbol, "prices", prices, "confidence", 72 + rnd.nextInt(18));
    }

    private double round(double val, int places) {
        double factor = Math.pow(10, places);
        return Math.round(val * factor) / factor;
    }
}
