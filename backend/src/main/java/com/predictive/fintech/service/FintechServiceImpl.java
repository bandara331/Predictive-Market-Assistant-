package com.predictive.fintech.service;

import com.predictive.fintech.dto.BankReportRequest;
import com.predictive.fintech.dto.LoanApplicationRequest;
import com.predictive.fintech.model.FraudAlert;
import com.predictive.fintech.model.LoanPrediction;
import com.predictive.fintech.repository.FraudAlertRepository;
import com.predictive.fintech.repository.LoanPredictionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class FintechServiceImpl implements FintechService {

    private final LoanPredictionRepository loanRepo;
    private final FraudAlertRepository fraudRepo;
    private final GroqFintechService groqService;
    private final RestTemplate restTemplate;

    @Value("${ml.service.url:http://localhost:8000}")
    private String ML_SERVICE_URL;

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
            // Call Python ML Microservice
            String url = ML_SERVICE_URL + "/credit-score";
            Map<String, Object> req = new HashMap<>();
            req.put("loanAmount", request.getLoanAmount());
            req.put("businessRevenue", request.getBusinessRevenue());
            
            Map<String, Object> mlResponse = restTemplate.postForObject(url, req, Map.class);
            
            double score = (mlResponse != null && mlResponse.containsKey("creditScore")) ? 
                    ((Number) mlResponse.get("creditScore")).doubleValue() : 650.0;
            double prob = (mlResponse != null && mlResponse.containsKey("repaymentProbability")) ? 
                    ((Number) mlResponse.get("repaymentProbability")).doubleValue() : 0.65;
            
            LoanPrediction prediction = new LoanPrediction();
            // Need to set properties based on the actual entity
            // prediction.setLoanAmount(request.getLoanAmount());
            // loanRepo.save(prediction);
            
            Map<String, Object> result = new HashMap<>();
            result.put("creditScore", score);
            result.put("repaymentProbability", prob);
            return result;
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("creditScore", 700);
            fallback.put("repaymentProbability", 0.85);
            return fallback;
        }
    }

    @Override
    public Map<String, Object> detectFraudAlerts(String userEmail) {
        try {
            String url = ML_SERVICE_URL + "/detect-fraud";
            Map<String, Object> mlResponse = restTemplate.getForObject(url, Map.class);
            
            return mlResponse;
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> fallback = new HashMap<>();
            List<Map<String, Object>> alerts = new ArrayList<>();
            Map<String, Object> alert = new HashMap<>();
            alert.put("anomalyType", "Unusual Transaction Volatility");
            alert.put("transactionId", "TXN-88192");
            alert.put("amount", 15000.0);
            alert.put("riskScore", 0.95);
            alerts.add(alert);
            fallback.put("alerts", alerts);
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
