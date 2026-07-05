-- ═══════════════════════════════════════════════════════════
--  PredictIQ — PostgreSQL Database Initialization Script
--  Run this once before starting the application.
-- ═══════════════════════════════════════════════════════════

-- Create database (run as superuser)
CREATE DATABASE predictive_db;
\c predictive_db;

-- Enable UUID extension (optional, for future use)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- The tables below are auto-created by Hibernate (ddl-auto=update).
-- This script is for reference and manual setup only.

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    first_name    VARCHAR(50)  NOT NULL,
    last_name     VARCHAR(50)  NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'USER',
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP
);

-- Stock data table (for persisting fetched OHLCV data)
CREATE TABLE IF NOT EXISTS stock_data (
    id           BIGSERIAL PRIMARY KEY,
    symbol       VARCHAR(10)    NOT NULL,
    trade_date   DATE           NOT NULL,
    open_price   DECIMAL(12, 4) NOT NULL,
    high_price   DECIMAL(12, 4) NOT NULL,
    low_price    DECIMAL(12, 4) NOT NULL,
    close_price  DECIMAL(12, 4) NOT NULL,
    volume       BIGINT         NOT NULL,
    created_at   TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP,
    UNIQUE (symbol, trade_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_symbol_date ON stock_data (symbol, trade_date);
CREATE INDEX IF NOT EXISTS idx_stock_symbol      ON stock_data (symbol);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users (email);
