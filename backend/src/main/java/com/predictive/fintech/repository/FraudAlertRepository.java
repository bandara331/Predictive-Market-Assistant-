package com.predictive.fintech.repository;

import com.predictive.fintech.model.FraudAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * FraudAlertRepository — Spring Data JPA repository for the AI Fintech module.
 * DOES NOT modify or extend any existing repository.
 */
@Repository
public interface FraudAlertRepository extends JpaRepository<FraudAlert, Long> {

    /** Fetch the 10 most recent fraud alerts for a user. */
    List<FraudAlert> findTop10ByUserEmailOrderByCreatedAtDesc(String userEmail);

    /** Find alerts by severity level for a user. */
    List<FraudAlert> findByUserEmailAndSeverityOrderByCreatedAtDesc(String userEmail, String severity);

    /** Count total alerts for a user. */
    long countByUserEmail(String userEmail);
}
