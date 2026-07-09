package com.predictive.fintech.model;

import com.predictive.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * BusinessSales — JPA Entity for the AI Fintech add-on module.
 *
 * OOP Design:
 *   Extends BaseEntity (Inheritance) — inherits id, createdAt, updatedAt
 *   from the shared base class via @MappedSuperclass.
 *
 * Creates a NEW table "business_sales".
 * DOES NOT alter any existing table.
 */
@Entity
@Table(
    name = "business_sales",
    indexes = {
        @Index(name = "idx_bs_user_email",      columnList = "user_email"),
        @Index(name = "idx_bs_reporting_month", columnList = "reporting_month"),
        @Index(name = "idx_bs_created",         columnList = "created_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessSales extends BaseEntity {

    /** Email of the authenticated user who submitted data */
    @Column(name = "user_email", nullable = false, length = 150)
    private String userEmail;

    /** Logical business identifier or name */
    @Column(name = "business_name", length = 200)
    private String businessName;

    /**
     * Reporting period identifier (e.g., "2024-06").
     * Stored as VARCHAR to allow partial reporting periods.
     */
    @Column(name = "reporting_month", length = 20)
    private String reportingMonth;

    @Column(name = "total_revenue")
    private Double totalRevenue;

    @Column(name = "net_profit")
    private Double netProfit;

    @Column(name = "cash_inflow")
    private Double cashInflow;

    @Column(name = "cash_outflow")
    private Double cashOutflow;

    @Column(name = "loan_amount")
    private Double loanAmount;

    /** Optional: Groq AI-generated financial summary stored for audit */
    @Column(name = "ai_report_text", columnDefinition = "TEXT")
    private String aiReportText;
}
