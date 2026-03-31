================================================================
SOFTWARE REQUIREMENTS SPECIFICATION
Credit Risk Intelligence & Advisory System (CRIAS)
Version 1.0 | March 31, 2026 | Stack: MERN + Python AI Service
================================================================

================================================================
SYSTEM GOAL
================================================================
A pipeline that:
1. Predicts Probability of Default (PD)
2. Explains why (SHAP)
3. Generates alternative financial states (DiCE)
4. Evaluates cost
5. Ranks strategies using RCES

================================================================
TECH STACK
================================================================
Frontend  : HTML5 + CSS3 + Vanilla JavaScript (NO React)
Backend   : Node.js + Express.js
Database  : MongoDB + Mongoose ODM
AI Layer  : Python Flask/FastAPI microservice
Auth      : JWT + bcrypt
Charts    : Chart.js (CDN)
HTTP      : Axios (frontend), node-fetch (backend)

================================================================
BACKEND API ENDPOINTS
================================================================

AUTH:
POST   /api/auth/register       - Register new user
POST   /api/auth/login          - Login, returns JWT
POST   /api/auth/logout         - Invalidate session
GET    /api/auth/me             - Get current user profile
PUT    /api/auth/password       - Change password

FIRMS:
POST   /api/firms               - Create firm
GET    /api/firms               - List all firms
GET    /api/firms/:id           - Get firm by ID
PUT    /api/firms/:id           - Update firm
DELETE /api/firms/:id           - Delete firm (admin only)
POST   /api/firms/:id/data      - Submit accounting data
POST   /api/firms/upload        - Bulk CSV upload

PREDICTIONS:
POST   /api/predict             - Run PD prediction
GET    /api/predict/:firmId     - Prediction history
GET    /api/predict/:firmId/latest - Latest prediction

AI ANALYSIS:
POST   /api/explain             - Get SHAP values
POST   /api/counterfactuals     - Generate DiCE scenarios
POST   /api/strategies          - Compute RCES rankings

ADMIN:
GET    /api/admin/users         - List users
PUT    /api/admin/users/:id/role - Update user role
DELETE /api/admin/users/:id     - Deactivate user
GET    /api/admin/logs          - Audit logs
GET    /api/admin/models        - List ML models
PUT    /api/admin/models/active - Set active model

================================================================
MONGODB COLLECTIONS & SCHEMAS
================================================================

COLLECTION: users
- _id: ObjectId
- fullName: String (required)
- email: String (required, unique, indexed)
- passwordHash: String (required, never returned in API)
- role: String enum [analyst, manager, admin]
- isActive: Boolean (default: true)
- lastLogin: Date
- createdAt: Date (auto)
- updatedAt: Date (auto)

COLLECTION: firms
- _id: ObjectId
- firmName: String (required)
- firmCode: String (required, unique)
- industry: String
- createdBy: ObjectId ref users
- assignedManager: ObjectId ref users
- createdAt: Date (auto)

COLLECTION: financial_entries
- _id: ObjectId
- firmId: ObjectId ref firms (indexed)
- submittedBy: ObjectId ref users
- reportingPeriod: Date
- raw.assets: Number (required, >= 0)
- raw.debt: Number (required, > 0)
- raw.cash: Number (required, >= 0)
- raw.inventory: Number (required, >= 0)
- features.current_ratio: Number (auto-computed: assets/debt)
- features.debt_ratio: Number (auto-computed: debt/assets)
- features.liquidity_ratio: Number (auto-computed: cash/debt)
- createdAt: Date (auto)

COLLECTION: predictions
- _id: ObjectId
- firmId: ObjectId ref firms (indexed)
- entryId: ObjectId ref financial_entries
- modelUsed: String enum [logistic_regression, random_forest, xgboost]
- modelVersion: String
- pd: Number [0, 1]
- riskLabel: String enum [low, medium, high, critical]
- shapValues: Array [{ feature, value, direction }]
- createdBy: ObjectId ref users
- createdAt: Date (auto, indexed)

COLLECTION: counterfactuals
- _id: ObjectId
- predictionId: ObjectId ref predictions
- firmId: ObjectId ref firms (indexed)
- scenarios: Array of:
    - features: Object (modified values)
    - pd_new: Number
    - cost: Number
    - rces: Number
    - rank: Number
- createdAt: Date (auto)

COLLECTION: audit_logs
- _id: ObjectId
- userId: ObjectId ref users (indexed)
- action: String enum [login, logout, predict, upload, admin_action]
- resource: String
- ipAddress: String
- userAgent: String
- status: String enum [success, failure]
- metadata: Object
- createdAt: Date (auto, TTL 365 days)

================================================================
FEATURE ENGINEERING
================================================================
Input raw fields: assets, debt, cash, inventory

Computed features:
- current_ratio  = assets / debt
- debt_ratio     = debt / assets
- liquidity_ratio = cash / debt

Rules:
- debt must be > 0 (enforced at schema level)
- Reject NaN or Infinity values
- Apply StandardScaler before model inference

================================================================
AI MICROSERVICE (Python) ENDPOINTS
================================================================
Base URL: http://localhost:5001 (configurable via AI_SERVICE_URL)

POST /ai/predict
  Body: { features: {current_ratio, debt_ratio, liquidity_ratio}, model_name }
  Returns: { pd: Number, riskLabel: String }

POST /ai/explain
  Body: { features, model_name, prediction_id }
  Returns: { shapValues: [{ feature, value, direction }] }

POST /ai/counterfactuals
  Body: { features, target_pd: 0.30, constraints: { cash, debt, inventory ranges } }
  Returns: { scenarios: Array of counterfactual feature sets }

POST /ai/strategies
  Body: { original, counterfactuals, pd_old }
  Returns: { ranked: [{ features, pd_new, cost, rces, rank }] }

================================================================
ML MODELS
================================================================
Three models available:
1. Logistic Regression (baseline, fast)
2. Random Forest (n_estimators=100, max_depth=10)
3. XGBoost (n_estimators=200, lr=0.05, max_depth=6) — DEFAULT

Class imbalance handling:
- SMOTE oversampling on training data
- class_weight='balanced' for LR and RF
- scale_pos_weight for XGBoost

Model artifacts stored as .pkl files (joblib serialization)

RCES Formula: (pd_old - pd_new) / (cost + 1)

Cost Formula:
cost = |delta_inventory| * 0.001
     + |delta_cash|      * 0.001
     + |delta_debt|      * 0.002

DiCE constraints:
- cash:      range [0, 10_000_000], step 10_000
- debt:      range [0, 50_000_000], step 50_000
- inventory: range [0, 20_000_000], step 25_000

================================================================
MIDDLEWARE PIPELINE (Express)
================================================================
1. helmet()           - Security headers
2. cors(options)      - Restrict to frontend origin
3. express.json()     - Parse JSON (max 10mb)
4. morgan('combined') - HTTP request logging
5. rateLimiter        - 100 req / 15 min per IP
6. authMiddleware     - Verify JWT, attach req.user
7. rbacMiddleware     - Role-based route access
8. express-validator  - Input validation & sanitization
9. errorHandler       - RFC 7807 error responses

================================================================
FRONTEND PAGES
================================================================
/login.html           - Public - Login form
/register.html        - Public - Registration form
/dashboard.html       - Analyst+ - Firm list, recent predictions
/firm.html?id=X       - Analyst+ - Firm detail + PD trend chart
/analyze.html         - Analyst+ - Data entry + model selection
/results.html?id=X    - Analyst+ - PD score, SHAP chart, strategies
/history.html         - Analyst+ - Paginated prediction history
/admin/users.html     - Admin - User management
/admin/models.html    - Admin - Active model configuration
/admin/logs.html      - Admin - Audit log viewer

================================================================
RISK CLASSIFICATION
================================================================
PD 0.00 - 0.30 => Low Risk      (standard monitoring)
PD 0.31 - 0.55 => Medium Risk   (increased review)
PD 0.56 - 0.75 => High Risk     (immediate strategy review)
PD 0.76 - 1.00 => Critical Risk (escalate to manager)

================================================================
ENVIRONMENT VARIABLES
================================================================
PORT                  - Express port (default 3000)
MONGODB_URI           - MongoDB Atlas connection string
JWT_SECRET            - Min 64 chars signing secret
JWT_EXPIRY            - Token expiry (default 24h)
AI_SERVICE_URL        - Python microservice base URL
AI_SERVICE_TIMEOUT    - Timeout ms (default 30000)
CORS_ORIGIN           - Allowed frontend origin
BCRYPT_ROUNDS         - Cost factor (default 10)
NODE_ENV              - development | production | test
LOG_LEVEL             - winston level (default info)

================================================================
PROJECT FOLDER STRUCTURE
================================================================
crias/
  backend/
    src/
      routes/         - auth.js, firms.js, predict.js, admin.js
      controllers/    - authController.js, firmController.js, etc.
      services/       - predictionService.js, aiService.js, etc.
      models/         - User.js, Firm.js, Prediction.js, etc.
      middleware/     - auth.js, rbac.js, rateLimiter.js, errorHandler.js
      utils/          - featureEngineering.js, logger.js
    .env.example
    server.js

  ai-service/
    models/           - xgboost_v3.pkl, random_forest_v2.pkl, etc.
    services/         - predictor.py, explainer.py, counterfactual.py, rces.py
    app.py

  frontend/
    pages/            - login.html, dashboard.html, analyze.html, etc.
    js/               - api.js, auth.js, state.js, charts.js, ui.js
    css/              - main.css, components.css, variables.css

  docs/
    CRIAS_SRS_v1.0.docx
================================================================