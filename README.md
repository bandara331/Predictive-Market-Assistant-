# PredictIQ — AI-Powered Predictive Market Assistant

> **Real-time stock predictions · Groq AI insights · LSTM deep learning · JWT-secured dashboard**

---

## Overview

PredictIQ is a full-stack AI financial intelligence platform that combines:

- 📈 **TradingView Lightweight Charts** for professional candlestick/line charting
- 🤖 **LSTM Neural Network** (TensorFlow) for 30-day stock price forecasting
- 💬 **Groq AI** (Llama 3.3 70B) for natural-language financial analysis
- 🔐 **Spring Boot + JWT** for secure, stateless authentication
- 🎨 **Glassmorphism UI** with dark-mode, particle animations, and live market data

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Frontend)                        │
│  HTML + Vanilla CSS + JS  │  TradingView Charts  │  Auth Flow   │
└────────────────────┬────────────────────────────────────────────┘
                     │  JWT-secured REST API
┌────────────────────▼────────────────────────────────────────────┐
│              Spring Boot Backend  (:8080)                        │
│   AuthController  │  DashboardController  │  StockService        │
│   JwtAuthFilter   │  UserService          │  SecurityConfig      │
└───────┬─────────────────────────────┬───────────────────────────┘
        │ JDBC                        │ HTTP
┌───────▼──────────┐        ┌────────▼────────────────────────────┐
│   PostgreSQL      │        │   FastAPI ML Microservice  (:8000)   │
│   :5432           │        │   StockPredictor (LSTM + yfinance)   │
│   users table     │        │   StockFetcher  │  LSTMModel         │
│   stock_data      │        └─────────────────────────────────────┘
└───────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Vanilla CSS (Glassmorphism), JavaScript ES6+ |
| Charts | TradingView Lightweight Charts |
| Backend | Java 17, Spring Boot 3.2, Spring Security, JWT (JJWT) |
| Database | PostgreSQL 16 |
| ML Service | Python 3.11, FastAPI, TensorFlow 2.16, scikit-learn |
| AI Chat | Groq API (Llama 3.3 70B) |
| Container | Docker + Docker Compose |

---

## Project Structure

```
predictive-market-assistant/
├── frontend/
│   ├── index.html              # Single-page app (auth + dashboard)
│   ├── css/
│   │   └── styles.css          # Full design system + components
│   └── js/
│       ├── auth.js             # JWT auth, login/register, demo mode
│       ├── chart.js            # TradingView chart integration
│       ├── stock-api.js        # Stock data, predictions, watchlist
│       ├── assistant.js        # Groq AI chat panel
│       └── dashboard.js        # App orchestrator, clock, market status
│
├── backend/
│   ├── Dockerfile
│   ├── pom.xml                 # Spring Boot 3.2, JWT, JPA, Lombok
│   └── src/main/java/com/predictive/
│       ├── config/             # SecurityConfig, JwtUtil, JwtAuthFilter
│       ├── controller/         # AuthController, DashboardController
│       ├── dto/                # RegisterRequest, LoginRequest, AuthResponse, StockDataDTO
│       ├── model/              # User (UserDetails), BaseEntity, StockData, Role
│       ├── repository/         # UserRepository, StockDataRepository
│       └── service/            # UserService/Impl, StockService/Impl
│
├── ml-service/
│   ├── Dockerfile
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt
│   ├── data/
│   │   └── stock_fetcher.py    # yfinance wrapper with caching
│   └── model/
│       ├── lstm_model.py       # TF/Keras 2-layer LSTM architecture
│       └── predictor.py        # End-to-end: fetch → train/load → forecast
│
├── docker-compose.yml          # Full stack local development
├── .env.example                # Environment variable template
└── .gitignore
```

---

## Quick Start

### Option A — Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/predictive-market-assistant.git
cd predictive-market-assistant

# 2. Set up environment variables
cp .env.example .env
# Edit .env — add your GROQ_API_KEY (get it free at console.groq.com)

# 3. Start all services
docker-compose up -d

# 4. Open the dashboard
# Open frontend/index.html in your browser
```

### Option B — Manual Setup

**Prerequisites:** Java 17+, Maven, Python 3.11+, PostgreSQL 16

#### 1. Database Setup
```sql
-- Create database (PostgreSQL)
createdb predictive_db
psql predictive_db < backend/src/main/resources/db-init.sql
```

#### 2. Backend (Spring Boot)
```bash
cd backend

# Set your config in application.properties or via env vars
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/predictive_db
export SPRING_DATASOURCE_PASSWORD=your_password
export GROQ_API_KEY=your_groq_api_key_here

mvn spring-boot:run
# Runs on http://localhost:8080
```

#### 3. ML Service (FastAPI)
```bash
cd ml-service

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate      # Linux/macOS
# venv\Scripts\activate       # Windows

# Install dependencies
pip install -r requirements.txt

# Start the service
python main.py
# Runs on http://localhost:8000
```

#### 4. Frontend
```bash
# Simply open in a browser — no build step needed!
# Works with any static file server:
cd frontend
python -m http.server 3000
# Then visit http://localhost:3000
```

---

## API Endpoints

### Auth (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create new user account |
| `POST` | `/api/auth/login` | Authenticate and receive JWT |
| `POST` | `/api/auth/logout` | Audit logout (JWT is stateless) |

### Dashboard (JWT Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stocks/{symbol}?timeframe=1M` | Historical OHLCV data |
| `GET` | `/api/dashboard/predict/{symbol}` | LSTM 30-day price forecast |
| `POST` | `/api/dashboard/chat` | Groq AI chat response |
| `GET` | `/api/dashboard/health` | Backend health check |

### ML Service (Internal)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/predict/{symbol}` | LSTM prediction (30 days) |
| `GET` | `/health` | ML service status |
| `GET` | `/symbols` | Supported stock symbols |

---

## Configuration

### Backend (`application.properties`)

| Property | Description |
|----------|-------------|
| `spring.datasource.url` | PostgreSQL connection URL |
| `jwt.secret` | JWT signing key (min 256-bit) |
| `jwt.expiration` | Token lifetime in milliseconds |
| `ml.service.url` | ML microservice base URL |
| `groq.api.key` | Your Groq API key |
| `groq.model` | Groq model (default: llama-3.3-70b-versatile) |

### Frontend (`js/assistant.js`)

Replace `YOUR_GROQ_API_KEY_HERE` with your Groq API key for direct browser-to-Groq fallback:
```javascript
const GROQ_API_KEY = 'gsk_your_key_here';
```

---

## Demo Mode

The app works **without any backend** using intelligent fallback:

- **Auth**: Demo sessions are created client-side with a mock JWT
- **Charts**: Realistic OHLCV data is generated with per-symbol volatility profiles
- **Predictions**: Seeded LSTM-style trend forecasts with confidence scores
- **AI Chat**: Pre-built contextual responses for common financial queries

This means you can open `frontend/index.html` directly in a browser and have a fully functional demo.

---

## Supported Stock Symbols

| Symbol | Company |
|--------|---------|
| AAPL | Apple Inc. |
| GOOGL | Alphabet Inc. |
| MSFT | Microsoft Corporation |
| TSLA | Tesla, Inc. |
| NVDA | NVIDIA Corporation |
| AMZN | Amazon.com, Inc. |

*The ML service also supports: META, NFLX, AMD, INTC, BABA, ORCL*

---

## ML Model Details

The LSTM model uses a 2-layer architecture:

```
Input (60 × 1)
  → LSTM(50, return_sequences=True) → Dropout(0.2)
  → LSTM(50, return_sequences=False) → Dropout(0.2)
  → Dense(25, relu)
  → Dense(1)
```

- **Training data**: 2 years of daily OHLCV (via yfinance)
- **Sequence length**: 60 trading days (look-back window)
- **Prediction horizon**: 30 trading days
- **Training strategy**: Early stopping + ReduceLROnPlateau
- **Model persistence**: Saved to `saved_models/{symbol}_lstm.keras`

---

## OOP Design Highlights

This project is designed to demonstrate clean OOP principles:

- **Inheritance**: `User extends BaseEntity`, `UserServiceImpl implements UserService`
- **Encapsulation**: `StockFetcher` isolates all yfinance logic; `LSTMModel` encapsulates all Keras operations
- **Polymorphism**: `User implements UserDetails` — treated as both a JPA entity and Spring Security principal
- **Composition**: `StockPredictor` composes `StockFetcher` and `LSTMModel` (composition over inheritance)
- **Interface Segregation**: Separate `UserService` and `StockService` interfaces with clean contracts

---

## License

MIT License — see [LICENSE](LICENSE) for details.
