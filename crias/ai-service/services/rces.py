"""
RCES (Risk-Cost-Effectiveness Score) Service
Ranks counterfactual strategies by cost-effectiveness
"""
import numpy as np
from services.predictor import PredictorService


class RCESService:
    def __init__(self):
        self.predictor = PredictorService()
        
        # Cost coefficients
        self.cost_weights = {
            'inventory': 0.001,
            'cash': 0.001,
            'debt': 0.002
        }
    
    def rank_strategies(self, original: dict, counterfactuals: list, 
                        pd_old: float) -> dict:
        """
        Rank counterfactual strategies using RCES
        
        RCES Formula: (pd_old - pd_new) / (cost + 1)
        
        Cost Formula:
        cost = |delta_inventory| * 0.001
             + |delta_cash| * 0.001  
             + |delta_debt| * 0.002
        
        Args:
            original: original feature values
            counterfactuals: list of counterfactual scenarios
            pd_old: original probability of default
        
        Returns:
            dict with ranked scenarios
        """
        model = self.predictor.get_model('xgboost')
        scaler = self.predictor.get_scaler()
        
        ranked = []
        
        for scenario in counterfactuals:
            features = scenario.get('features', scenario)
            
            # Calculate new PD if not already present
            if 'pd_new' not in scenario:
                X = np.array([[
                    features.get('current_ratio', 1.0),
                    features.get('debt_ratio', 0.5),
                    features.get('liquidity_ratio', 0.3)
                ]])
                X_scaled = scaler.transform(X)
                pd_new = float(model.predict_proba(X_scaled)[0][1])
            else:
                pd_new = scenario['pd_new']
            
            # Calculate cost
            cost = self._calculate_cost(original, features)
            
            # Calculate RCES
            pd_reduction = pd_old - pd_new
            rces = pd_reduction / (cost + 1)
            
            ranked.append({
                'features': features,
                'pd_new': round(pd_new, 4),
                'cost': round(cost, 2),
                'rces': round(rces, 6),
                'pd_reduction': round(pd_reduction, 4)
            })
        
        # Sort by RCES (higher is better)
        ranked.sort(key=lambda x: x['rces'], reverse=True)
        
        # Add rank
        for i, item in enumerate(ranked):
            item['rank'] = i + 1
        
        return {'ranked': ranked}
    
    def _calculate_cost(self, original: dict, new: dict) -> float:
        """
        Calculate the cost of transitioning from original to new state
        
        Cost = |delta_inventory| * 0.001 + |delta_cash| * 0.001 + |delta_debt| * 0.002
        """
        cost = 0.0
        
        # Inventory change cost
        orig_inv = original.get('inventory', 0)
        new_inv = new.get('inventory', orig_inv)
        cost += abs(new_inv - orig_inv) * self.cost_weights['inventory']
        
        # Cash change cost  
        orig_cash = original.get('cash', 0)
        new_cash = new.get('cash', orig_cash)
        cost += abs(new_cash - orig_cash) * self.cost_weights['cash']
        
        # Debt change cost
        orig_debt = original.get('debt', 0)
        new_debt = new.get('debt', orig_debt)
        cost += abs(new_debt - orig_debt) * self.cost_weights['debt']
        
        return cost
