package com.predictive.fintech.service;

import com.predictive.fintech.dto.BankReportRequest;
import com.predictive.fintech.dto.LoanApplicationRequest;
import com.predictive.fintech.model.LoanPrediction;
import com.predictive.fintech.repository.FraudAlertRepository;
import com.predictive.fintech.repository.LoanPredictionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * FintechServiceImpl — Concrete implementation of FintechService.
 *
 * OOP Design:
 *   - Implements FintechService interface (Polymorphism).
 *   - Completely isolated from the existing AiDashboardServiceImpl.
 */
@Service
public class FintechServiceImpl implements FintechService {

    private static final Logger log = LoggerFactory.getLogger(FintechServiceImpl.class);

    private final LoanPredictionRepository loanRepo;
    private final FraudAlertRepository fraudRepo;
    private final GroqFintechService groqService;
    private final RestTemplate restTemplate;

    @Value("${ml.service.url:http://localhost:8000}")
    private String mlServiceUrl;

    @Autowired
    public FintechServiceImpl(LoanPredictionRepository loanRepo,
                              FraudAlertRepository fraudRepo,
                              GroqFintechService groqService) {
        this.loanRepo = loanRepo;
        this.fraudRepo = fraudRepo;
        this.groqService = groqService;
        this.restTemplate = new RestTemplate();
    }

    @Override
    public Map<String, Object> predictLoanRisk(LoanApplicationRequest request, String userEmail) {
        try {
            String url = mlServiceUrl + "/credit-score";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // BUG FIX: LoanApplicationRequest has annualRevenue (not businessRevenue)
            Map<String, Object> reqBody = new HashMap<>();
            reqBody.put("loanAmount", request.getLoanAmount() != null ? request.getLoanAmount() : 0.0);
            reqBody.put("businessRevenue", request.getAnnualRevenue() != null ? request.getAnnualRevenue() : 0.0);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(reqBody, headers);

            Map<String, Object> mlResponse = restTemplate.postForObject(url, entity, Map.class);

            double score = (mlResponse != null && mlResponse.containsKey("creditScore"))
                    ? ((Number) mlResponse.get("creditScore")).doubleValue() : 650.0;
            double prob = (mlResponse != null && mlResponse.containsKey("repaymentProbability"))
                    ? ((Number) mlResponse.get("repaymentProbability")).doubleValue() : 0.65;

            Map<String, Object> result = new HashMap<>();
            result.put("creditScore", score);
            result.put("repaymentProbability", prob);
            return result;

        } catch (Exception e) {
            log.error("Loan risk prediction failed, returning fallback: {}", e.getMessage());
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("creditScore", 700);
            fallback.put("repaymentProbability", 0.85);
            return fallback;
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public Map<String, Object> detectFraudAlerts(String userEmail) {
        List<Map<String, Object>> alertList = getFraudAlertList(userEmail);
        Map<String, Object> result = new HashMap<>();
        result.put("alerts", alertList);
        return result;
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getFraudAlertList(String userEmail) {
        try {
            String url = mlServiceUrl + "/detect-fraud";
            // BUG FIX: /detect-fraud returns a JSON array (List), not a Map
            List<Map<String, Object>> alerts = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    null,
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}
            ).getBody();

            return alerts != null ? alerts : new ArrayList<>();

        } catch (Exception e) {
            log.error("Fraud detection failed, returning fallback alert: {}", e.getMessage());
            List<Map<String, Object>> fallback = new ArrayList<>();
            Map<String, Object> alert = new HashMap<>();
            alert.put("anomalyType", "Unusual Transaction Volatility");
            alert.put("transactionId", "TXN-88192");
            alert.put("amount", 15000.0);
            alert.put("riskScore", 0.95);
            fallback.add(alert);
            return fallback;
        }
    }

    @Override
    public Map<String, Object> generateBankReport(BankReportRequest request, String userEmail) {
        String report = groqService.generateFinancialSummary(request);
        Map<String, Object> result = new HashMap<>();
        result.put("reportContent", report);
        return result;
    }

    @Override
    public Map<String, Object> getCashFlowData(String userEmail) {
        return new HashMap<>();
    }
}
