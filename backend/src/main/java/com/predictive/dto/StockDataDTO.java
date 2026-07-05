package com.predictive.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** Stock data DTO for API responses */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockDataDTO {

    private String symbol;
    private String timeframe;
    private List<OhlcvBar> ohlcv;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OhlcvBar {
        private long timestamp;   // Unix epoch seconds (TradingView format)
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal close;
        private long volume;
    }
}
