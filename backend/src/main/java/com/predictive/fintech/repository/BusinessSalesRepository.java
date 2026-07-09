package com.predictive.fintech.repository;

import com.predictive.fintech.model.BusinessSales;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * BusinessSalesRepository — Spring Data JPA repository for the AI Fintech module.
 *
 * OOP Design: Follows the same Repository-pattern as the existing
 * StockDataRepository and AiInsightLogRepository — completely isolated from both.
 *
 * DOES NOT modify or extend any existing repository.
 */
@Repository
public interface BusinessSalesRepository extends JpaRepository<BusinessSales, Long> {

    /** Fetch the most recent 12 sales records for a user (for chart data). */
    List<BusinessSales> findTop12ByUserEmailOrderByCreatedAtDesc(String userEmail);

    /** Fetch all records for a specific business and user. */
    List<BusinessSales> findByUserEmailAndBusinessNameOrderByCreatedAtDesc(String userEmail, String businessName);
}
