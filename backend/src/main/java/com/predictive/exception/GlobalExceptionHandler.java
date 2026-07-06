package com.predictive.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * GlobalExceptionHandler — Centralized REST API error handling.
 * Catches domain and validation exceptions and returns structured JSON errors.
 * Demonstrates OOP: aspect-oriented design through Spring's @RestControllerAdvice.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /* ─── Validation Errors (400) ─── */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationErrors(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field   = ((FieldError) error).getField();
            String message = error.getDefaultMessage();
            fieldErrors.put(field, message);
        });
        return errorResponse(HttpStatus.BAD_REQUEST, "Validation failed", fieldErrors);
    }

    /* ─── User Already Exists (409) ─── */
    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<Map<String, Object>> handleUserAlreadyExists(UserAlreadyExistsException ex) {
        log.warn("Registration conflict: {}", ex.getMessage());
        return errorResponse(HttpStatus.CONFLICT, ex.getMessage(), null);
    }

    /* ─── Bad Credentials (401) ─── */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        return errorResponse(HttpStatus.UNAUTHORIZED, "Invalid email or password.", null);
    }

    /* ─── Generic Fallback (500) ─── */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.", null);
    }

    /* ─── Helper ─── */
    private ResponseEntity<Map<String, Object>> errorResponse(
            HttpStatus status, String message, Object details
    ) {
        Map<String, Object> body = new HashMap<>();
        body.put("status",    status.value());
        body.put("message",   message);
        body.put("timestamp", LocalDateTime.now().toString());
        if (details != null) body.put("errors", details);
        return ResponseEntity.status(status).body(body);
    }
}
