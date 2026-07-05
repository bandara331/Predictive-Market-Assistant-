package com.predictive.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * StockData — Historical OHLCV stock data entity extending BaseEntity.
 * Demonstrates OOP Inheritance from BaseEntity.
 */
@Entity
@Table(name = "stock_data",
    indexes = {
        @Index(name = "idx_stock_symbol_date", columnList = "symbol, trade_date"),
        @Index(name = "idx_stock_symbol",      columnList = "symbol")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockData extends BaseEntity {

    @Column(name = "symbol", nullable = false, length = 10)
    private String symbol;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "open_price", nullable = false, precision = 12, scale = 4)
    private BigDecimal openPrice;

    @Column(name = "high_price", nullable = false, precision = 12, scale = 4)
    private BigDecimal highPrice;

    @Column(name = "low_price", nullable = false, precision = 12, scale = 4)
    private BigDecimal lowPrice;

    @Column(name = "close_price", nullable = false, precision = 12, scale = 4)
    private BigDecimal closePrice;

    @Column(name = "volume", nullable = false)
    private Long volume;
}
