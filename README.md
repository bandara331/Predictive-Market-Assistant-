# PredictIQ — AI Business & Financial Dashboard

A full-stack **AI-powered stock market prediction platform** built as a Software Engineering internship project. Features real-time OHLCV charts, LSTM neural network price predictions, and a Groq AI-powered financial analyst chat assistant.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  index.html  ←→  auth.js + stock-api.js + chart.js         │
│                  dashboard.js + assistant.js                │
│  (TradingView Lightweight Charts, Groq AI Chat)             │
└──────────────────┬──────────────────────────────────────────┘
                   │ REST / JWT
┌──────────────────▼──────────────────────────────────────────┐
│                SPRING BOOT BACKEND (Port 8080)              │
│  AuthController  ←→  UserServiceImpl  ←→  UserRepository   │
│  DashboardController ←→ StockServiceImpl ←→ StockRepository │
│  SecurityConfig (JWT) + GlobalExceptionHandler              │
└──────────────┬────────────────────┬────────────────────────-┘
               │ JPA/PostgreSQL      │ REST
  ┌────────────▼──────────┐   ┌─────▼─────────────────────────┐
  │  PostgreSQL (Port 5432)│   │  FastAPI ML Service (Port 8000)│
  │  users table           │   │  LSTM TensorFlow model         │
  │  stock_data table      │   │  yfinance data fetcher         │
  └────────────────────────┘   └────────────────────────────────┘
```

---

## 🚀 Quick Start

### Option A — Docker (Recommended, zero setup)

```bash
# 1. Clone the repo
git clone <repo-url>
cd predictive-market-assistant

# 2. Copy and configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# 3. Start all services
docker-compose up -d

# 4. Open the frontend
# Open frontend/index.html in your browser
# Backend: http://localhost:8080
# ML Service: http://localhost:8000/docs
```

### Option B — Local Development (without Docker)

#### Prerequisites
- Java 17+, Maven 3.9+
- Python 3.11+
- PostgreSQL 15+ (or skip — use local H2 profile)
- Node.js (optional, for a local HTTP server)

#### Backend (Spring Boot)

```bash
cd backend

# With H2 (no PostgreSQL needed):
mvn spring-boot:run -Dspring-boot.run.profiles=local

# With PostgreSQL (update application.properties first):
mvn spring-boot:run
```

- API: `http://localhost:8080` (local profile: `8081`)
- H2 Console: `http://localhost:8081/h2-console`

#### ML Service (FastAPI)

```bash
cd ml-service
pip install -r requirements.txt
python main.py
```

- API Docs: `http://localhost:8000/docs`

#### Frontend

Simply open `frontend/index.html` directly in your browser, or use a local server:

```bash
# Python simple server from project root:
python -m http.server 3000
# Then visit: http://localhost:3000/frontend/
```

---

## 📁 Project Structure

```
predictive-market-assistant/
├── frontend/                       # Pure HTML/CSS/JS SPA
│   ├── index.html                  # Single-page app (auth + dashboard)
│   ├── css/styles.css              # Full dark-mode design system
│   └── js/
│       ├── auth.js                 # JWT login/register, demo mode fallback
│       ├── chart.js                # TradingView Lightweight Charts integration
│       ├── stock-api.js            # OHLCV fetching, watchlist, synthetic data
│       ├── assistant.js            # Groq AI chat panel
│       └── dashboard.js            # App orchestrator, clock, market status
│
├── backend/                        # Spring Boot 3 REST API
│   ├── src/main/java/com/predictive/
│   │   ├── PredictiveMarketApplication.java
│   │   ├── config/
│   │   │   ├── AppConfig.java      # CORS + RestTemplate bean
│   │   │   ├── SecurityConfig.java # JWT-based stateless security
│   │   │   ├── JwtUtil.java        # JJWT 0.12 token utility
│   │   │   └── JwtAuthFilter.java  # Per-request JWT validation filter
│   │   ├── controller/
│   │   │   ├── AuthController.java # POST /api/auth/register, /login, /logout
│   │   │   └── DashboardController.java # GET /api/dashboard/stocks/{symbol}, /predict/{symbol}, POST /chat
│   │   ├── service/
│   │   │   ├── UserService.java    # Interface (OOP Polymorphism)
│   │   │   ├── UserServiceImpl.java
│   │   │   ├── StockService.java
│   │   │   └── StockServiceImpl.java # Proxies ML & Groq, synthetic fallback
│   │   ├── model/
│   │   │   ├── BaseEntity.java     # Abstract base with audit fields (OOP Inheritance)
│   │   │   ├── User.java           # UserDetails + JPA entity
│   │   │   ├── StockData.java      # OHLCV entity
│   │   │   └── Role.java           # USER / ADMIN enum
│   │   ├── dto/
│   │   │   ├── AuthResponse.java
│   │   │   ├── LoginRequest.java
│   │   │   ├── RegisterRequest.java
│   │   │   └── StockDataDTO.java
│   │   ├── repository/
│   │   │   ├── UserRepository.java
│   │   │   └── StockDataRepository.java
│   │   └── exception/
│   │       ├── GlobalExceptionHandler.java  # @RestControllerAdvice
│   │       └── UserAlreadyExistsException.java
│   ├── src/main/resources/
│   │   ├── application.properties           # PostgreSQL / production
│   │   ├── application-local.properties     # H2 / local dev profile
│   │   └── db-init.sql                      # Manual DB initialization reference
│   ├── src/test/
│   │   └── PredictiveMarketApplicationTests.java
│   │   └── service/UserServiceImplTest.java
│   ├── Dockerfile                           # Multi-stage Java build
│   └── pom.xml                             # Spring Boot 3.2.5, Java 17
│
├── ml-service/                     # Python FastAPI ML Microservice
│   ├── main.py                     # FastAPI app + CORS + lifespan
│   ├── model/
│   │   ├── lstm_model.py           # TensorFlow 2-layer LSTM architecture
│   │   └── predictor.py            # End-to-end: fetch → preprocess → train → predict
│   ├── data/
│   │   └── stock_fetcher.py        # yfinance wrapper with caching
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml              # Full stack: postgres + backend + ml-service
├── .env.example                    # Environment variable template
└── README.md
```

---

## 🔑 API Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/auth/register` | `{firstName, lastName, email, password}` | `{token, type, expiresIn, user}` |
| `POST` | `/api/auth/login` | `{email, password}` | `{token, type, expiresIn, user}` |
| `POST` | `/api/auth/logout` | — | `{message}` |

### Dashboard (`/api/dashboard`) — Requires JWT

| Method | Endpoint | Params | Response |
|--------|----------|--------|----------|
| `GET` | `/api/dashboard/stocks/{symbol}` | `?timeframe=1M` | OHLCV bars |
| `GET` | `/api/dashboard/predict/{symbol}` | — | 30-day price predictions |
| `POST` | `/api/dashboard/chat` | `{message, symbol, history}` | AI response |
| `GET` | `/api/dashboard/health` | — | Status check |

### ML Service (`http://localhost:8000`)

| Method | Endpoint | Response |
|--------|----------|----------|
| `GET` | `/predict/{symbol}` | `{symbol, prices, confidence}` |
| `GET` | `/symbols` | Supported tickers |
| `GET` | `/health` | Service status |

---

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and set your values:

```env
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your-256-bit-secret-key     # openssl rand -hex 32
GROQ_API_KEY=gsk_...                    # https://console.groq.com/keys
```

### Groq API Key

Get a **free** API key at [console.groq.com](https://console.groq.com/keys) and set:
- **Frontend**: `assistant.js` → `GROQ_API_KEY` constant
- **Backend**: `application.properties` → `groq.api.key` (or via `GROQ_API_KEY` env var)

> **Demo Mode**: The app works fully without any API keys. Auth uses JWT tokens, stock data is generated synthetically, and the AI chat returns pre-scripted responses.

---

## 🧠 OOP Concepts Demonstrated

| Concept | Where |
|---------|-------|
| **Inheritance** | `User extends BaseEntity`, `StockData extends BaseEntity` |
| **Polymorphism** | `UserService` / `StockService` interfaces + `*Impl` concrete classes |
| **Encapsulation** | `StockFetcher`, `LSTMModel`, `StockPredictor` — all internal state private |
| **Abstraction** | Controllers only depend on service interfaces, never on implementations |
| **Composition** | `StockPredictor` composes `StockFetcher` and `LSTMModel` |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, Vanilla CSS (glassmorphism), JavaScript ES2022+ |
| Charts | TradingView Lightweight Charts |
| Backend | Spring Boot 3.2, Spring Security, Spring Data JPA |
| Auth | JWT (JJWT 0.12), BCrypt |
| Database | PostgreSQL 16 (production), H2 (local dev) |
| ML Service | Python 3.11, FastAPI, TensorFlow 2.16, yfinance |
| AI Chat | Groq API (Llama 3.3 70B) |
| Containerization | Docker, Docker Compose |

---

## 🧪 Running Tests

```bash
cd backend

# Run all tests
mvn test

# Run with local (H2) profile only
mvn test -Dspring.profiles.active=local

# Run specific test class
mvn test -Dtest=UserServiceImplTest
```

---

## 📊 Supported Stock Symbols

`AAPL` · `GOOGL` · `MSFT` · `TSLA` · `NVDA` · `AMZN` · `META` · `NFLX` · `AMD` · `INTC` · `BABA` · `ORCL`

---

## 🐳 Docker Commands Reference

```bash
# Start all services
docker-compose up -d

# Tail logs for a specific service
docker-compose logs -f backend
docker-compose logs -f ml-service

# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes (wipes DB)
docker-compose down -v

# Rebuild images after code changes
docker-compose up -d --build
```

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|---------|
| Backend won't start | Check `SPRING_DATASOURCE_URL` env var; use local H2 profile for development |
| ML service slow to start | Normal — TensorFlow model initialization takes ~30-60 seconds |
| CORS errors | Ensure frontend origin is in `AppConfig.java` `allowedOriginPatterns` |
| JWT invalid token | Token may be expired (24h) — log out and log in again |
| No chart data | App falls back to synthetic demo data when backend is offline |
| Groq AI not responding | Set a valid `GROQ_API_KEY`; without it, demo responses are returned |

---

*Built with ❤️ for the SMART Internship Programme*
