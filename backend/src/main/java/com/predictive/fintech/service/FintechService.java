package com.predictive.fintech.service;

import com.predictive.fintech.dto.BankReportRequest;
import com.predictive.fintech.dto.LoanApplicationRequest;

import java.util.List;
import java.util.Map;

/**
 * FintechService — Service interface for the AI Fintech & Business Dashboard module.
 *
 * OOP Design:
 *   - Interface-based abstraction (Polymorphism).
 *   - Defines the contract for all fintech business logic.
 *   - Concrete implementation is FintechServiceImpl, injected at runtime by Spring IoC.
 *   - Completely isolated from the existing AiDashboardService interface.
 */
public interface FintechService {

    /**
     * Calls the Python ML Microservice with the loan application features,
     * receives a credit score + repayment probability, and returns the result map.
     *
     * @param request   input features from the UI form
     * @param userEmail authenticated user's email (for audit)
     * @return map: creditScore, repaymentProbability
     */
    Map<String, Object> predictLoanRisk(LoanApplicationRequest request, String userEmail);

    /**
     * Calls the Python ML Microservice to run anomaly detection on transactions.
     * Returns raw response map from ML service.
     *
     * @param userEmail authenticated user's email
     * @return map with key "alerts" → list of alert objects
     */
    Map<String, Object> detectFraudAlerts(String userEmail);

    /**
     * Returns a typed list of fraud alert maps, ready for the controller to return.
     * Extracted for clean controller usage without unsafe casting.
     *
     * @param userEmail authenticated user's email
     * @return list of alert maps
     */
    List<Map<String, Object>> getFraudAlertList(String userEmail);

    /**
     * Constructs a detailed Groq API prompt and returns the AI-generated report text.
     *
     * @param request   business financials context
     * @param userEmail authenticated user's email
     * @return map: reportContent (full text)
     */
    Map<String, Object> generateBankReport(BankReportRequest request, String userEmail);

    /**
     * Returns historical cash-flow series. Falls back to empty when table is empty.
     *
     * @param userEmail authenticated user's email
     * @return map: historical, forecast
     */
    Map<String, Object> getCashFlowData(String userEmail);
}

