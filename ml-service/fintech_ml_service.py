from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
import random
import uvicorn
import time

app = FastAPI(title="Fintech ML Microservice", description="Isolated ML service for Fintech Analytics")

class LoanRequest(BaseModel):
    loanAmount: float
    businessRevenue: float

class DemandForecastRequest(BaseModel):
    historicalData: list[float]

@app.post("/credit-score")
def predict_credit_score(request: LoanRequest):
    """
    Simulates a Credit Risk Scoring model for Micro-Loans.
    """
    try:
        # Dummy ML logic: higher revenue and lower loan amount yields better score
        base_score = 650
        ratio = request.businessRevenue / (request.loanAmount + 1)
        
        bonus = min(200, ratio * 10)
        final_score = min(850, base_score + bonus)
        
        probability = (final_score - 300) / 550.0
        
        return {
            "creditScore": round(final_score),
            "repaymentProbability": round(probability, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/detect-fraud")
def detect_fraud():
    """
    Simulates an Anomaly Detection model (e.g., Isolation Forest).
    """
    # Randomly decide if there's an anomaly
    alerts = []
    if random.random() > 0.3:  # 70% chance to return some anomalies
        alerts.append({
            "anomalyType": "Unusual Transaction Volume",
            "transactionId": f"TXN-{random.randint(10000, 99999)}",
            "amount": round(random.uniform(5000, 50000), 2),
            "riskScore": round(random.uniform(0.8, 0.99), 2)
        })
    return alerts

@app.post("/predict-demand")
def predict_demand(request: DemandForecastRequest):
    """
    Simulates an LSTM Demand Forecasting model.
    """
    if not request.historicalData:
        raise HTTPException(status_code=400, detail="Historical data required")
    
    # Just a dummy forecast extending the last value with noise
    last_val = request.historicalData[-1]
    forecast = []
    for i in range(30):
        next_val = last_val + random.uniform(-100, 150)
        forecast.append(round(next_val, 2))
        last_val = next_val
        
    return {"forecast": forecast}

if __name__ == "__main__":
    # Run on a separate port to avoid clashing with the main AI dashboard ML service (e.g., 8000)
    uvicorn.run(app, host="0.0.0.0", port=8001)
