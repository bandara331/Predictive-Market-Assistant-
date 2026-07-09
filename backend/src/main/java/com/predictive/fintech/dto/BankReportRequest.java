package com.predictive.fintech.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * BankReportRequest — DTO for the POST /api/fintech/report/generate endpoint.
 *
 * Carries the business financial context that will be injected into the
 * Groq LLM system prompt to generate a structured bank loan summary.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BankReportRequest {

    private String  businessName;
    private Double  annualRevenue;
    private Double  loanAmount;
    private Double  existingDebt;

    /** Number of active fraud alerts (from the fraud panel) for context */
    private Integer fraudAlertCount;

    /** Most recent credit score from the loan predictor (nullable) */
    private Integer latestCreditScore;
}
