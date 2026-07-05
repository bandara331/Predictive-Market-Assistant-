package com.predictive.service;

import com.predictive.dto.AuthResponse;
import com.predictive.dto.LoginRequest;
import com.predictive.dto.RegisterRequest;

/**
 * UserService — Service interface demonstrating OOP Polymorphism.
 * The concrete implementation (UserServiceImpl) can be swapped without
 * changing any controller code — classic Dependency Inversion.
 */
public interface UserService {

    /**
     * Registers a new user and returns a JWT auth response.
     * @throws com.predictive.exception.UserAlreadyExistsException if email taken
     */
    AuthResponse register(RegisterRequest request);

    /**
     * Authenticates a user and returns a JWT auth response.
     * @throws org.springframework.security.authentication.BadCredentialsException if invalid
     */
    AuthResponse login(LoginRequest request);

    /**
     * Loads a user by email for Spring Security.
     */
    org.springframework.security.core.userdetails.UserDetails loadUserByEmail(String email);
}
