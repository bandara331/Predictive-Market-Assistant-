package com.predictive.service;

import com.predictive.dto.AuthResponse;
import com.predictive.dto.LoginRequest;
import com.predictive.dto.RegisterRequest;
import org.springframework.security.core.userdetails.UserDetailsService;

/**
 * UserService — Service interface demonstrating OOP Polymorphism.
 * Extends UserDetailsService so Spring Security can auto-discover the bean.
 * The concrete implementation (UserServiceImpl) can be swapped without
 * changing any controller code — classic Dependency Inversion.
 */
public interface UserService extends UserDetailsService {

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
     * Loads a user by email for Spring Security (delegates to loadUserByUsername).
     */
    org.springframework.security.core.userdetails.UserDetails loadUserByEmail(String email);
}
