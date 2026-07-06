package com.predictive.exception;

/**
 * UserAlreadyExistsException — thrown when registration is attempted
 * with an email address that is already registered.
 *
 * Demonstrates OOP: custom exception hierarchy for domain errors.
 */
public class UserAlreadyExistsException extends RuntimeException {

    public UserAlreadyExistsException(String email) {
        super("An account with email '" + email + "' already exists.");
    }

    public UserAlreadyExistsException(String message, Throwable cause) {
        super(message, cause);
    }
}
