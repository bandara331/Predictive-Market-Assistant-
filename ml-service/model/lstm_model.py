"""
lstm_model.py — TensorFlow/Keras LSTM model architecture for stock price prediction.
Two-layer LSTM with dropout regularization and a Dense output layer.
"""

import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout, Input
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import logging
import os

logger = logging.getLogger(__name__)


class LSTMModel:
    """
    Two-layer LSTM model for univariate time-series price prediction.

    Architecture (OOP encapsulation — model is fully self-contained):
      Input  → LSTM(50, return_sequences=True) → Dropout(0.2)
             → LSTM(50, return_sequences=False) → Dropout(0.2)
             → Dense(25) → Dense(1)
    """

    def __init__(self, sequence_length: int = 60, features: int = 1):
        self.sequence_length = sequence_length
        self.features        = features
        self.model: Sequential | None = None

    def build(self) -> Sequential:
        """Build and compile the LSTM model."""
        model = Sequential([
            Input(shape=(self.sequence_length, self.features)),

            # First LSTM layer — return sequences for stacking
            LSTM(units=50, return_sequences=True),
            Dropout(0.2),

            # Second LSTM layer
            LSTM(units=50, return_sequences=False),
            Dropout(0.2),

            # Fully-connected head
            Dense(units=25, activation="relu"),
            Dense(units=1)
        ], name="PredictIQ_LSTM")

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss="mean_squared_error",
            metrics=["mae"]
        )

        self.model = model
        logger.info(f"LSTM model built: seq_len={self.sequence_length}, features={self.features}")
        model.summary(print_fn=logger.info)
        return model

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        epochs: int = 50,
        batch_size: int = 32,
        validation_split: float = 0.1,
    ) -> tf.keras.callbacks.History:
        """Train the LSTM model with early stopping."""
        if self.model is None:
            self.build()

        callbacks = [
            EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True, verbose=1),
            ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=4, min_lr=1e-6, verbose=1),
        ]

        history = self.model.fit(
            X_train, y_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=callbacks,
            verbose=0,
            shuffle=False,       # Preserve time-series order
        )
        logger.info(f"Training complete. Final val_loss: {history.history['val_loss'][-1]:.6f}")
        return history

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Run inference and return predictions."""
        if self.model is None:
            raise RuntimeError("Model not built or loaded. Call .build() or .load() first.")
        return self.model.predict(X, verbose=0)

    def save(self, path: str) -> None:
        """Save model weights to disk."""
        if self.model:
            self.model.save(path)
            logger.info(f"Model saved to {path}")

    def load(self, path: str) -> None:
        """Load a previously saved model."""
        if os.path.exists(path):
            self.model = load_model(path)
            logger.info(f"Model loaded from {path}")
        else:
            logger.warning(f"No saved model at {path}. Building fresh model.")
            self.build()
