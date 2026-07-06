package com.predictive.service;

import com.predictive.config.JwtUtil;
import com.predictive.dto.AuthResponse;
import com.predictive.dto.LoginRequest;
import com.predictive.dto.RegisterRequest;
import com.predictive.exception.UserAlreadyExistsException;
import com.predictive.model.Role;
import com.predictive.model.User;
import com.predictive.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * UserServiceImplTest — Unit tests for user registration and login logic.
 * Uses Mockito to isolate the service layer from JPA and JWT dependencies.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock  UserRepository  userRepository;
    @Mock  PasswordEncoder passwordEncoder;
    @Mock  JwtUtil         jwtUtil;
    @InjectMocks UserServiceImpl userService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .firstName("Jane")
                .lastName("Doe")
                .email("jane@example.com")
                .passwordHash("$2a$12$hashedPassword")
                .role(Role.USER)
                .build();
    }

    /* ─── Registration ─── */

    @Test
    @DisplayName("register — success: returns JWT response with correct user info")
    void register_success() {
        RegisterRequest req = new RegisterRequest();
        req.setFirstName("Jane");
        req.setLastName("Doe");
        req.setEmail("jane@example.com");
        req.setPassword("Password123!");

        when(userRepository.existsByEmail("jane@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Password123!")).thenReturn("$2a$12$hashed");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);
        when(jwtUtil.generateToken(any(User.class))).thenReturn("mock.jwt.token");

        AuthResponse response = userService.register(req);

        assertThat(response.getToken()).isEqualTo("mock.jwt.token");
        assertThat(response.getType()).isEqualTo("Bearer");
        assertThat(response.getUser().getEmail()).isEqualTo("jane@example.com");
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("register — conflict: throws UserAlreadyExistsException if email taken")
    void register_emailAlreadyExists() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("jane@example.com");
        req.setPassword("Password123!");

        when(userRepository.existsByEmail("jane@example.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.register(req))
                .isInstanceOf(UserAlreadyExistsException.class)
                .hasMessageContaining("jane@example.com");

        verify(userRepository, never()).save(any());
    }

    /* ─── Login ─── */

    @Test
    @DisplayName("login — success: returns JWT response for valid credentials")
    void login_success() {
        LoginRequest req = new LoginRequest();
        req.setEmail("jane@example.com");
        req.setPassword("Password123!");

        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("Password123!", sampleUser.getPasswordHash())).thenReturn(true);
        when(jwtUtil.generateToken(sampleUser)).thenReturn("mock.jwt.token");

        AuthResponse response = userService.login(req);

        assertThat(response.getToken()).isEqualTo("mock.jwt.token");
    }

    @Test
    @DisplayName("login — failure: throws BadCredentialsException for wrong password")
    void login_wrongPassword() {
        LoginRequest req = new LoginRequest();
        req.setEmail("jane@example.com");
        req.setPassword("WrongPassword!");

        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("WrongPassword!", sampleUser.getPasswordHash())).thenReturn(false);

        assertThatThrownBy(() -> userService.login(req))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    @DisplayName("login — failure: throws BadCredentialsException for unknown email")
    void login_unknownEmail() {
        LoginRequest req = new LoginRequest();
        req.setEmail("unknown@example.com");
        req.setPassword("Password123!");

        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.login(req))
                .isInstanceOf(BadCredentialsException.class);
    }
}
