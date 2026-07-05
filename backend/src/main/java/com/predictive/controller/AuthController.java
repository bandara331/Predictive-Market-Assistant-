package com.predictive.controller;

import com.predictive.dto.AuthResponse;
import com.predictive.dto.LoginRequest;
import com.predictive.dto.RegisterRequest;
import com.predictive.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AuthController — REST controller for authentication endpoints.
 * Demonstrates RESTful API design with proper HTTP status codes.
 *
 * Endpoints:
 *   POST /api/auth/register  — Create new account
 *   POST /api/auth/login     — Authenticate and receive JWT
 *   POST /api/auth/logout    — Client-side token invalidation
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final UserService userService;

    /* ─── Register ─── */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            AuthResponse response = userService.register(request);
            log.info("User registered: {}", request.getEmail());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (RuntimeException e) {
            log.warn("Registration failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", e.getMessage()));
        }
    }

    /* ─── Login ─── */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            AuthResponse response = userService.login(request);
            log.info("User authenticated: {}", request.getEmail());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.warn("Authentication failed for {}: {}", request.getEmail(), e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid email or password."));
        }
    }

    /* ─── Logout (stateless — handled client-side, endpoint for audit) ─── */
    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        // JWT is stateless — client deletes the token from storage
        // This endpoint exists for audit logging and future token blacklisting
        return ResponseEntity.ok(Map.of("message", "Logged out successfully."));
    }
}
