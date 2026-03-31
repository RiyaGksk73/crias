"""
Counterfactual Service
DiCE-based counterfactual generation
"""
import numpy as np
import pandas as pd
from services.predictor import PredictorService


class CounterfactualService:
    def __init__(self):
        self.predictor = PredictorService()
        self.feature_names = ['current_ratio', 'debt_ratio', 'liquidity_ratio']
        
        # Default constraints
        self.default_constraints = {
            'cash': {'min': 0, 'max': 10_000_000, 'step': 10_000},
            'debt': {'min': 0, 'max': 50_000_000, 'step': 50_000},
            'inventory': {'min': 0, 'max': 20_000_000, 'step': 25_000}
        }
    
    def generate(self, features: dict, target_pd: float = 0.30, 
                 constraints: dict = None, num_scenarios: int = 5) -> dict:
        """
        Generate counterfactual scenarios
        
        Args:
            features: current feature values (including raw values)
            target_pd: target probability of default
            constraints: optional constraints for each feature
            num_scenarios: number of scenarios to generate
        
        Returns:
            dict with scenarios array
        """
        constraints = {**self.default_constraints, **(constraints or {})}
        
        # Extract current values
        current_features = {
            'current_ratio': features.get('current_ratio', 1.0),
            'debt_ratio': features.get('debt_ratio', 0.5),
            'liquidity_ratio': features.get('liquidity_ratio', 0.3)
        }
        
        current_raw = {
            'assets': features.get('assets', 1_000_000),
            'debt': features.get('debt', 500_000),
            'cash': features.get('cash', 200_000),
            'inventory': features.get('inventory', 100_000)
        }
        
        # Generate counterfactual scenarios using grid search approach
        scenarios = []
        
        # Strategy 1: Increase cash (improve liquidity)
        for cash_increase in [0.1, 0.2, 0.3, 0.5, 0.8]:
            new_cash = current_raw['cash'] * (1 + cash_increase)
            if new_cash <= constraints['cash']['max']:
                scenario = self._create_scenario(current_raw, cash=new_cash)
                scenarios.append(scenario)
        
        # Strategy 2: Reduce debt
        for debt_decrease in [0.1, 0.2, 0.3, 0.4, 0.5]:
            new_debt = current_raw['debt'] * (1 - debt_decrease)
            if new_debt >= constraints['debt']['min'] and new_debt > 0:
                scenario = self._create_scenario(current_raw, debt=new_debt)
                scenarios.append(scenario)
        
        # Strategy 3: Combined - increase cash and reduce debt
        for cash_increase in [0.2, 0.3]:
            for debt_decrease in [0.2, 0.3]:
                new_cash = current_raw['cash'] * (1 + cash_increase)
                new_debt = current_raw['debt'] * (1 - debt_decrease)
                if (new_cash <= constraints['cash']['max'] and 
                    new_debt >= constraints['debt']['min'] and new_debt > 0):
                    scenario = self._create_scenario(
                        current_raw, cash=new_cash, debt=new_debt
                    )
                    scenarios.append(scenario)
        
        # Strategy 4: Reduce inventory (convert to cash)
        for inv_decrease in [0.2, 0.3, 0.5]:
            new_inventory = current_raw['inventory'] * (1 - inv_decrease)
            new_cash = current_raw['cash'] + (current_raw['inventory'] - new_inventory) * 0.8
            if new_inventory >= 0:
                scenario = self._create_scenario(
                    current_raw, cash=new_cash, inventory=new_inventory
                )
                scenarios.append(scenario)
        
        # Predict PD for each scenario and filter by target
        valid_scenarios = []
        model = self.predictor.get_model('xgboost')
        scaler = self.predictor.get_scaler()
        
        for scenario in scenarios:
            X = np.array([[
                scenario['features']['current_ratio'],
                scenario['features']['debt_ratio'],
                scenario['features']['liquidity_ratio']
            ]])
            X_scaled = scaler.transform(X)
            pd_new = float(model.predict_proba(X_scaled)[0][1])
            
            if pd_new <= target_pd:
                scenario['pd_new'] = round(pd_new, 4)
                valid_scenarios.append(scenario)
        
        # Sort by pd_new and take top scenarios
        valid_scenarios.sort(key=lambda x: x['pd_new'])
        
        return {'scenarios': valid_scenarios[:num_scenarios]}
    
    def _create_scenario(self, current: dict, **changes) -> dict:
        """Create a scenario with specified changes"""
        raw = {**current, **changes}
        
        # Recompute features
        features = {
            'current_ratio': raw['assets'] / raw['debt'] if raw['debt'] > 0 else 0,
            'debt_ratio': raw['debt'] / raw['assets'] if raw['assets'] > 0 else 0,
            'liquidity_ratio': raw['cash'] / raw['debt'] if raw['debt'] > 0 else 0
        }
        
        return {
            'features': {
                **features,
                'assets': raw['assets'],
                'debt': raw['debt'],
                'cash': raw['cash'],
                'inventory': raw['inventory']
            }
        }
