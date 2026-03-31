"""
Predictor Service
Handles ML model loading and prediction
"""
import os
import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

# Use GradientBoosting as XGBoost alternative (no extra dependencies)


class PredictorService:
    def __init__(self):
        self.models = {}
        self.scaler = StandardScaler()
        self.feature_names = ['current_ratio', 'debt_ratio', 'liquidity_ratio']
        self._init_models()
    
    def _init_models(self):
        """Initialize or load models"""
        model_path = os.environ.get('MODEL_PATH', './models')
        
        # Try to load existing models, or create defaults
        try:
            self.models['logistic_regression'] = joblib.load(f'{model_path}/logistic_regression.pkl')
            self.models['random_forest'] = joblib.load(f'{model_path}/random_forest.pkl')
            self.models['xgboost'] = joblib.load(f'{model_path}/xgboost.pkl')
            self.scaler = joblib.load(f'{model_path}/scaler.pkl')
        except FileNotFoundError:
            # Create default models with synthetic training
            self._create_default_models()
    
    def _create_default_models(self):
        """Create and train default models with synthetic data"""
        np.random.seed(42)
        n_samples = 1000
        
        # Generate synthetic training data
        # Good firms: high current ratio, low debt ratio, high liquidity
        good_firms = np.column_stack([
            np.random.uniform(1.5, 3.0, n_samples // 2),  # current_ratio
            np.random.uniform(0.2, 0.5, n_samples // 2),  # debt_ratio
            np.random.uniform(0.3, 0.8, n_samples // 2),  # liquidity_ratio
        ])
        
        # Risky firms: low current ratio, high debt ratio, low liquidity
        risky_firms = np.column_stack([
            np.random.uniform(0.5, 1.5, n_samples // 2),  # current_ratio
            np.random.uniform(0.5, 0.9, n_samples // 2),  # debt_ratio
            np.random.uniform(0.05, 0.3, n_samples // 2), # liquidity_ratio
        ])
        
        X = np.vstack([good_firms, risky_firms])
        y = np.array([0] * (n_samples // 2) + [1] * (n_samples // 2))
        
        # Shuffle
        indices = np.random.permutation(n_samples)
        X, y = X[indices], y[indices]
        
        # Fit scaler
        self.scaler.fit(X)
        X_scaled = self.scaler.transform(X)
        
        # Train models
        self.models['logistic_regression'] = LogisticRegression(
            class_weight='balanced',
            random_state=42
        )
        self.models['logistic_regression'].fit(X_scaled, y)
        
        self.models['random_forest'] = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            class_weight='balanced',
            random_state=42
        )
        self.models['random_forest'].fit(X_scaled, y)
        
        # Use GradientBoosting as XGBoost alternative
        self.models['xgboost'] = GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            random_state=42
        )
        self.models['xgboost'].fit(X_scaled, y)
        
        # Save models
        model_path = os.environ.get('MODEL_PATH', './models')
        os.makedirs(model_path, exist_ok=True)
        
        joblib.dump(self.models['logistic_regression'], f'{model_path}/logistic_regression.pkl')
        joblib.dump(self.models['random_forest'], f'{model_path}/random_forest.pkl')
        joblib.dump(self.models['xgboost'], f'{model_path}/xgboost.pkl')
        joblib.dump(self.scaler, f'{model_path}/scaler.pkl')
    
    def predict(self, features: dict, model_name: str = 'xgboost') -> dict:
        """
        Predict probability of default
        
        Args:
            features: dict with current_ratio, debt_ratio, liquidity_ratio
            model_name: one of logistic_regression, random_forest, xgboost
        
        Returns:
            dict with pd and riskLabel
        """
        if model_name not in self.models:
            raise ValueError(f"Unknown model: {model_name}")
        
        # Extract and order features
        X = np.array([[
            features.get('current_ratio', 1.0),
            features.get('debt_ratio', 0.5),
            features.get('liquidity_ratio', 0.3)
        ]])
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        # Predict probability
        model = self.models[model_name]
        proba = model.predict_proba(X_scaled)[0]
        pd_value = float(proba[1])  # Probability of default (class 1)
        
        # Determine risk label
        risk_label = self._get_risk_label(pd_value)
        
        return {
            'pd': round(pd_value, 4),
            'riskLabel': risk_label,
            'modelVersion': 'v1.0'
        }
    
    def _get_risk_label(self, pd: float) -> str:
        """Get risk classification based on PD"""
        if pd <= 0.30:
            return 'low'
        elif pd <= 0.55:
            return 'medium'
        elif pd <= 0.75:
            return 'high'
        else:
            return 'critical'
    
    def get_loaded_models(self) -> list:
        """Return list of loaded model names"""
        return list(self.models.keys())
    
    def get_scaler(self):
        """Return the fitted scaler"""
        return self.scaler
    
    def get_model(self, model_name: str):
        """Return a specific model"""
        return self.models.get(model_name)
