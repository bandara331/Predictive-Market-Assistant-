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
 *
 * Endpoints served:
 *   POST /api/fintech/loan/predict      → predictLoanRisk
 *   GET  /api/fintech/fraud/detect      → detectFraudAlerts
 *   POST /api/fintech/report/generate   → generateBankReport
 *   GET  /api/fintech/cashflow          → getCashFlowData
 */
public interface FintechService {

    /**
     * Calls the Python Fintech ML Microservice (port 8002) with the loan application
     * features, receives a credit score + risk classification, persists the
     * LoanPrediction entity, and returns the result map.
     *
     * @param request   input features from the UI form
     * @param userEmail authenticated user's email (for audit)
     * @return map: creditScore, riskLevel, repaymentProbability, dtiRatio, recommendation
     */
    Map<String, Object> predictLoanRisk(LoanApplicationRequest request, String userEmail);

    /**
     * Calls the Python Fintech ML Microservice (port 8002) to run Isolation Forest
     * anomaly detection on a simulated transaction dataset.
     * Persists flagged FraudAlert entities and returns the list of alerts.
     *
     * @param userEmail authenticated user's email
     * @return map with key "alerts" → list of alert objects
     */
    Map<String, Object> detectFraudAlerts(String userEmail);

    /**
     * Constructs a detailed Groq API prompt including the business financial context
     * from the request, calls the Groq LLM (via the existing groq.api.* config),
     * persists the report to BusinessSales, and returns the AI-generated report text.
     *
     * @param request   business financials and ML context
     * @param userEmail authenticated user's email
     * @return map: report (full text), model, responseMs
     */
    Map<String, Object> generateBankReport(BankReportRequest request, String userEmail);

    /**
     * Returns historical cash-flow series from the business_sales table for the
     * authenticated user. Falls back to synthetic data when the table is empty.
     *
     * @param userEmail authenticated user's email
     * @return map: historical (list of {date, inflow, outflow}), forecast (30-day list)
     */
    Map<String, Object> getCashFlowData(String userEmail);
}
