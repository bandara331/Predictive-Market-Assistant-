package com.predictive.fintech.model;

import com.predictive.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * FraudAlert — JPA Entity for the AI Fintech add-on module.
 *
 * OOP Design:
 *   Extends BaseEntity (Inheritance) — inherits id, createdAt, updatedAt.
 *   Part of the com.predictive.fintech domain hierarchy.
 *
 * Creates a NEW table "fraud_alerts".
 * DOES NOT alter any existing table.
 *
 * Anomalies are flagged by the Python ML microservice using
 * scikit-learn's IsolationForest on transaction features.
 */
@Entity
@Table(
    name = "fraud_alerts",
    indexes = {
        @Index(name = "idx_fa_user_email",   columnList = "user_email"),
        @Index(name = "idx_fa_severity",     columnList = "severity"),
        @Index(name = "idx_fa_transaction",  columnList = "transaction_id"),
        @Index(name = "idx_fa_created",      columnList = "created_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FraudAlert extends BaseEntity {

    @Column(name = "user_email", nullable = false, length = 150)
    private String userEmail;

    /** Unique transaction reference (TXN-XXXXXXXX format) */
    @Column(name = "transaction_id", nullable = false, length = 50)
    private String transactionId;

    /** Transaction amount in USD */
    @Column(name = "amount")
    private Double amount;

    /** Merchant category (e.g., "Crypto Exchange", "Online Gaming") */
    @Column(name = "merchant_category", length = 100)
    private String merchantCategory;

    /**
     * Anomaly score from Isolation Forest (negative or zero = anomaly).
     * Stored as absolute value (0.0 – 1.0), higher = more anomalous.
     */
    @Column(name = "anomaly_score")
    private Double anomalyScore;

    /**
     * Severity classification: "critical", "high", "medium", "low".
     * Derived from anomalyScore thresholds in the ML microservice.
     */
    @Column(name = "severity", length = 20)
    private String severity;

    /** Human-readable explanation of why the transaction was flagged */
    @Column(name = "flag_reason", columnDefinition = "TEXT")
    private String flagReason;
}
