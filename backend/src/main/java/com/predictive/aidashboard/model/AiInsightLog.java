package com.predictive.aidashboard.model;

import com.predictive.model.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * AiInsightLog — Entity for the AI Analytics add-on module.
 *
 * OOP Design: Extends BaseEntity (Inheritance) to inherit id, createdAt,
 * updatedAt fields and the JPA auditing configuration automatically.
 *
 * Creates a NEW table "ai_insight_logs" — does NOT alter any existing tables.
 */
@Entity
@Table(name = "ai_insight_logs",
    indexes = {
        @Index(name = "idx_ai_log_email",   columnList = "user_email"),
        @Index(name = "idx_ai_log_symbol",  columnList = "symbol"),
        @Index(name = "idx_ai_log_created", columnList = "created_at")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiInsightLog extends BaseEntity {

    /** Email of the authenticated user who made the request */
    @Column(name = "user_email", nullable = false, length = 150)
    private String userEmail;

    /** Stock symbol that was being analyzed (e.g., AAPL) */
    @Column(name = "symbol", nullable = false, length = 10)
    private String symbol;

    /** The user's query message */
    @Column(name = "query_text", nullable = false, columnDefinition = "TEXT")
    private String queryText;

    /** The AI-generated response */
    @Column(name = "response_text", nullable = false, columnDefinition = "TEXT")
    private String responseText;

    /** LLM model identifier used for the response */
    @Column(name = "model_used", length = 100)
    private String modelUsed;

    /** Response latency in milliseconds */
    @Column(name = "response_ms")
    private Long responseMs;
}
