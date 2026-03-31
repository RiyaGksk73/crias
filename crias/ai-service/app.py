"""
CRIAS AI Microservice
Flask-based API for ML predictions, SHAP explanations, and counterfactuals
"""
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Import services
from services.predictor import PredictorService
from services.explainer import ExplainerService
from services.counterfactual import CounterfactualService
from services.rces import RCESService

# Initialize services
predictor = PredictorService()
explainer = ExplainerService()
counterfactual_service = CounterfactualService()
rces_service = RCESService()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'crias-ai',
        'models_loaded': predictor.get_loaded_models()
    })


@app.route('/ai/predict', methods=['POST'])
def predict():
    """
    Predict Probability of Default
    Body: { features: {current_ratio, debt_ratio, liquidity_ratio}, model_name }
    Returns: { pd: Number, riskLabel: String }
    """
    try:
        data = request.get_json()
        features = data.get('features', {})
        model_name = data.get('model_name', 'xgboost')
        
        result = predictor.predict(features, model_name)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/ai/explain', methods=['POST'])
def explain():
    """
    Get SHAP values for a prediction
    Body: { features, model_name, prediction_id }
    Returns: { shapValues: [{ feature, value, direction }] }
    """
    try:
        data = request.get_json()
        features = data.get('features', {})
        model_name = data.get('model_name', 'xgboost')
        
        result = explainer.explain(features, model_name)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/ai/counterfactuals', methods=['POST'])
def counterfactuals():
    """
    Generate counterfactual scenarios using DiCE
    Body: { features, target_pd, constraints }
    Returns: { scenarios: Array of counterfactual feature sets }
    """
    try:
        data = request.get_json()
        features = data.get('features', {})
        target_pd = data.get('target_pd', 0.30)
        constraints = data.get('constraints', {})
        
        result = counterfactual_service.generate(features, target_pd, constraints)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/ai/strategies', methods=['POST'])
def strategies():
    """
    Compute RCES rankings for counterfactual scenarios
    Body: { original, counterfactuals, pd_old }
    Returns: { ranked: [{ features, pd_new, cost, rces, rank }] }
    """
    try:
        data = request.get_json()
        original = data.get('original', {})
        counterfactuals = data.get('counterfactuals', [])
        pd_old = data.get('pd_old', 0.5)
        
        result = rces_service.rank_strategies(original, counterfactuals, pd_old)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400


if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5001))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
