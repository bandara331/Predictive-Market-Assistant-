package com.predictive.fintech.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * LoanApplicationRequest — DTO for the POST /api/fintech/loan/predict endpoint.
 *
 * OOP Design: Simple value-carrier following the same DTO pattern as the
 * existing AiDashboardChatRequest in the aidashboard module. Completely isolated.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoanApplicationRequest {

    /** Optional: business name for display and audit */
    private String businessName;

    /** Annual revenue in USD (primary income signal) */
    private Double annualRevenue;

    /** Requested loan amount in USD */
    private Double loanAmount;

    /** Length of credit history in months */
    private Integer creditHistoryMonths;

    /** Total existing debt obligations in USD */
    private Double existingDebt;
}
