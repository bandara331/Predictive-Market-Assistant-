package com.predictive.fintech.service;

import com.predictive.fintech.dto.BankReportRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * GroqFintechService — Dedicated LLM service for the Fintech dashboard.
 * Calls the Groq API to generate professional financial health summaries.
 * Completely isolated from any existing Groq usage in the main module.
 */
@Service
public class GroqFintechService {

    private static final Logger log = LoggerFactory.getLogger(GroqFintechService.class);

    @Value("${groq.api.key:your_groq_api_key_here}")
    private String groqApiKey;

    @Value("${groq.api.url:https://api.groq.com/openai/v1/chat/completions}")
    private String groqApiUrl;

    // BUG FIX: Read model from properties (consistent with groq.model property)
    @Value("${groq.model:llama-3.3-70b-versatile}")
    private String groqModel;

    private final RestTemplate restTemplate = new RestTemplate();

    public String generateFinancialSummary(BankReportRequest request) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(groqApiKey);

            // BUG FIX: Build a rich prompt using the actual fields in BankReportRequest
            // instead of calling non-existent getBusinessId()
            String userPromptContent = buildPrompt(request);

            Map<String, Object> body = new HashMap<>();
            body.put("model", groqModel);

            List<Map<String, String>> messages = new ArrayList<>();

            Map<String, String> systemMsg = new HashMap<>();
            systemMsg.put("role", "system");
            systemMsg.put("content",
                "You are an expert AI financial analyst specializing in SME loan assessments. " +
                "Generate a highly professional, structured financial summary for a bank loan application. " +
                "Format your response as clean markdown with sections for: Executive Summary, Key Financial Metrics, Risk Assessment, and Recommendation."
            );
            messages.add(systemMsg);

            Map<String, String> userMsg = new HashMap<>();
            userMsg.put("role", "user");
            userMsg.put("content", userPromptContent);
            messages.add(userMsg);

            body.put("messages", messages);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            log.info("Calling Groq API for financial summary generation...");

            Map<String, Object> response = restTemplate.postForObject(groqApiUrl, entity, Map.class);

            if (response != null && response.containsKey("choices")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                if (!choices.isEmpty()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    return (String) message.get("content");
                }
            }
            return "Unable to generate report at this time.";

        } catch (Exception e) {
            log.error("Groq API call failed: {}", e.getMessage());
            return buildFallbackReport(request);
        }
    }

    private String buildPrompt(BankReportRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate a professional financial health summary for a bank loan application with the following details:\n\n");

        if (request.getBusinessName() != null && !request.getBusinessName().isBlank()) {
            sb.append("Business Name: ").append(request.getBusinessName()).append("\n");
        }
        if (request.getAnnualRevenue() != null) {
            sb.append("Annual Revenue: $").append(String.format("%,.2f", request.getAnnualRevenue())).append("\n");
        }
        if (request.getLoanAmount() != null) {
            sb.append("Requested Loan Amount: $").append(String.format("%,.2f", request.getLoanAmount())).append("\n");
        }
        if (request.getExistingDebt() != null) {
            sb.append("Existing Debt: $").append(String.format("%,.2f", request.getExistingDebt())).append("\n");
        }
        if (request.getLatestCreditScore() != null) {
            sb.append("AI Credit Score: ").append(request.getLatestCreditScore()).append(" / 850\n");
        }
        if (request.getFraudAlertCount() != null) {
            sb.append("Active Fraud Alerts: ").append(request.getFraudAlertCount()).append("\n");
        }

        sb.append("\nProvide a concise, data-driven report suitable for submission to a bank underwriting team.");
        return sb.toString();
    }

    private String buildFallbackReport(BankReportRequest request) {
        String name = (request.getBusinessName() != null && !request.getBusinessName().isBlank())
                ? request.getBusinessName() : "Business";
        return "## Financial Health Summary — " + name + "\n\n" +
               "> *Note: This is a system-generated fallback report. Groq API is currently unavailable.*\n\n" +
               "### Executive Summary\n" +
               "The business demonstrates adequate financial standing for the requested loan amount.\n\n" +
               "### Risk Assessment\n" +
               "- **Risk Level:** Moderate\n" +
               "- **Liquidity:** Healthy\n" +
               "- **Debt Obligations:** Within acceptable range\n\n" +
               "### Recommendation\n" +
               "Proceed with standard underwriting review. Manual verification of supporting documents advised.";
    }
}
