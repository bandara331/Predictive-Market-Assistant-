package com.predictive.repository;

import com.predictive.model.StockData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * StockDataRepository — JPA repository for historical OHLCV stock data.
 */
@Repository
public interface StockDataRepository extends JpaRepository<StockData, Long> {

    List<StockData> findBySymbolOrderByTradeDateAsc(String symbol);

    List<StockData> findBySymbolAndTradeDateBetweenOrderByTradeDateAsc(
            String symbol, LocalDate startDate, LocalDate endDate);

    @Query("SELECT s FROM StockData s WHERE s.symbol = :symbol ORDER BY s.tradeDate DESC LIMIT 1")
    java.util.Optional<StockData> findLatestBySymbol(@Param("symbol") String symbol);

    boolean existsBySymbolAndTradeDate(String symbol, LocalDate tradeDate);
}
