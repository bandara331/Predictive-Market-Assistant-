package com.predictive.aidashboard.repository;

import com.predictive.aidashboard.model.AiInsightLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * AiInsightLogRepository — JPA Repository for the AI Analytics add-on module.
 *
 * OOP Design: Interface-based abstraction (Polymorphism). Spring Data JPA
 * provides the concrete implementation at runtime via proxy generation.
 *
 * Isolated from the existing StockDataRepository and UserRepository.
 */
@Repository
public interface AiInsightLogRepository extends JpaRepository<AiInsightLog, Long> {

    /**
     * Retrieves the 20 most recent AI chat interactions for a specific user,
     * ordered by creation date descending (most recent first).
     *
     * @param userEmail the authenticated user's email
     * @return list of up to 20 AiInsightLog records
     */
    List<AiInsightLog> findTop20ByUserEmailOrderByCreatedAtDesc(String userEmail);

    /**
     * Retrieves recent interactions for a user filtered by a specific stock symbol.
     *
     * @param userEmail the authenticated user's email
     * @param symbol    the stock ticker symbol
     * @return list of up to 10 AiInsightLog records for that symbol
     */
    List<AiInsightLog> findTop10ByUserEmailAndSymbolOrderByCreatedAtDesc(String userEmail, String symbol);
}
