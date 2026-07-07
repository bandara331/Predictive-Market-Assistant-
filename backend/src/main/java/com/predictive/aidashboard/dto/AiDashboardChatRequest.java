package com.predictive.aidashboard.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * AiDashboardChatRequest — DTO for the AI chat endpoint in the add-on module.
 *
 * OOP Design: Plain POJO demonstrating encapsulation. Lombok @Data generates
 * getters, setters, equals, hashCode, and toString automatically.
 *
 * Isolated from existing LoginRequest, RegisterRequest, and StockDataDTO.
 */
@Data
public class AiDashboardChatRequest {

    /** The user's chat message */
    private String message;

    /** The stock symbol being analyzed (e.g., AAPL) */
    private String symbol;

    /**
     * Conversation history for multi-turn context.
     * Each entry is a map with "role" (user/assistant) and "content" keys.
     */
    private List<Map<String, String>> history;
}
