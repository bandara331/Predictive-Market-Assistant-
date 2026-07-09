package com.predictive.fintech.controller;

import com.predictive.fintech.dto.BankReportRequest;
import com.predictive.fintech.dto.LoanApplicationRequest;
import com.predictive.fintech.service.FintechService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/fintech")
@CrossOrigin(origins = "*", maxAge = 3600)
public class FintechController {

    private final FintechService fintechService;

    @Autowired
    public FintechController(FintechService fintechService) {
        this.fintechService = fintechService;
    }

    @PostMapping("/loan-prediction")
    public ResponseEntity<Map<String, Object>> predictLoan(@RequestBody LoanApplicationRequest request) {
        // In a real app, userEmail comes from SecurityContext
        String userEmail = "user@example.com";
        Map<String, Object> result = fintechService.predictLoanRisk(request, userEmail);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/fraud-alerts")
    public ResponseEntity<List<Map<String, Object>>> getFraudAlerts() {
        String userEmail = "user@example.com";
        List<Map<String, Object>> alerts = fintechService.getFraudAlertList(userEmail);
        return ResponseEntity.ok(alerts);
    }

    @PostMapping("/bank-report")
    public ResponseEntity<Map<String, Object>> generateReport(@RequestBody BankReportRequest request) {
        String userEmail = "user@example.com";
        Map<String, Object> result = fintechService.generateBankReport(request, userEmail);
        return ResponseEntity.ok(result);
    }
}
