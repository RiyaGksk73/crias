"""
Explainer Service
SHAP-based model explanations
"""
import numpy as np
import shap
from services.predictor import PredictorService


class ExplainerService:
    def __init__(self):
        self.predictor = PredictorService()
        self.feature_names = ['current_ratio', 'debt_ratio', 'liquidity_ratio']
        self.explainers = {}
        self._init_explainers()
    
    def _init_explainers(self):
        """Initialize SHAP explainers for each model"""
        # Create background data for explainers
        np.random.seed(42)
        background_data = np.random.uniform(
            low=[0.5, 0.2, 0.05],
            high=[3.0, 0.9, 0.8],
            size=(100, 3)
        )
        background_scaled = self.predictor.get_scaler().transform(background_data)
        
        # Initialize explainers for each model type
        for model_name in ['logistic_regression', 'random_forest', 'xgboost']:
            model = self.predictor.get_model(model_name)
            if model is not None:
                if model_name == 'xgboost':
                    self.explainers[model_name] = shap.TreeExplainer(model)
                elif model_name == 'random_forest':
                    self.explainers[model_name] = shap.TreeExplainer(model)
                else:
                    self.explainers[model_name] = shap.LinearExplainer(
                        model, background_scaled
                    )
    
    def explain(self, features: dict, model_name: str = 'xgboost') -> dict:
        """
        Generate SHAP explanation for a prediction
        
        Args:
            features: dict with current_ratio, debt_ratio, liquidity_ratio
            model_name: model to explain
        
        Returns:
            dict with shapValues array
        """
        if model_name not in self.explainers:
            raise ValueError(f"No explainer for model: {model_name}")
        
        # Extract and order features
        X = np.array([[
            features.get('current_ratio', 1.0),
            features.get('debt_ratio', 0.5),
            features.get('liquidity_ratio', 0.3)
        ]])
        
        # Scale features
        X_scaled = self.predictor.get_scaler().transform(X)
        
        # Get SHAP values
        explainer = self.explainers[model_name]
        shap_values = explainer.shap_values(X_scaled)
        
        # Handle different output formats
        if isinstance(shap_values, list):
            # Binary classification - take values for positive class
            values = shap_values[1][0] if len(shap_values) > 1 else shap_values[0][0]
        else:
            values = shap_values[0]
        
        # Format results
        shap_results = []
        for i, feature in enumerate(self.feature_names):
            value = float(values[i])
            shap_results.append({
                'feature': feature,
                'value': round(value, 4),
                'direction': 'positive' if value > 0 else 'negative'
            })
        
        # Sort by absolute value (most important first)
        shap_results.sort(key=lambda x: abs(x['value']), reverse=True)
        
        return {'shapValues': shap_results}
