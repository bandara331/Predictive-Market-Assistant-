package com.predictive.fintech.model;

import com.predictive.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * LoanPrediction — JPA Entity for the AI Fintech add-on module.
 *
 * OOP Design:
 *   Extends BaseEntity (Inheritance) — inherits id, createdAt, updatedAt.
 *   Demonstrates polymorphism as part of the com.predictive.fintech domain model
 *   hierarchy, parallel to (but isolated from) the existing AiInsightLog entity.
 *
 * Creates a NEW table "loan_predictions".
 * DOES NOT alter any existing table.
 */
@Entity
@Table(
    name = "loan_predictions",
    indexes = {
        @Index(name = "idx_lp_user_email",  columnList = "user_email"),
        @Index(name = "idx_lp_risk_level",  columnList = "risk_level"),
        @Index(name = "idx_lp_created",     columnList = "created_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanPrediction extends BaseEntity {

    @Column(name = "user_email", nullable = false, length = 150)
    private String userEmail;

    @Column(name = "business_name", length = 200)
    private String businessName;

    /** Raw annual revenue used as input feature */
    @Column(name = "annual_revenue")
    private Double annualRevenue;

    /** Requested loan amount */
    @Column(name = "loan_amount")
    private Double loanAmount;

    /** Credit history length in months */
    @Column(name = "credit_history_months")
    private Integer creditHistoryMonths;

    /** Sum of any existing debt obligations */
    @Column(name = "existing_debt")
    private Double existingDebt;

    /**
     * AI-computed credit score (0–850 scale).
     * Produced by the Python ML microservice (Fintech ML Service on port 8002).
     */
    @Column(name = "credit_score")
    private Integer creditScore;

    /**
     * Risk classification: "Low", "Medium", or "High".
     * Derived from creditScore thresholds (≥700 = Low, ≥550 = Medium, else = High).
     */
    @Column(name = "risk_level", length = 20)
    private String riskLevel;

    /** Probability (0–100) that the borrower repays on time, per ML model */
    @Column(name = "repayment_probability")
    private Integer repaymentProbability;

    /** Debt-to-Income ratio computed by the service */
    @Column(name = "dti_ratio")
    private Double dtiRatio;

    /** Final underwriting recommendation: "Approve", "Review", or "Decline" */
    @Column(name = "recommendation", length = 20)
    private String recommendation;
}
