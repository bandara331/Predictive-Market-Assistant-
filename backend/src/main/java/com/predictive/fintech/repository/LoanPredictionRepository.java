package com.predictive.fintech.repository;

import com.predictive.fintech.model.LoanPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * LoanPredictionRepository — Spring Data JPA repository for the AI Fintech module.
 * DOES NOT modify or extend any existing repository.
 */
@Repository
public interface LoanPredictionRepository extends JpaRepository<LoanPrediction, Long> {

    /** Fetch the 20 most recent loan predictions for a user. */
    List<LoanPrediction> findTop20ByUserEmailOrderByCreatedAtDesc(String userEmail);

    /** Count how many predictions were made for a user in this module. */
    long countByUserEmail(String userEmail);
}
