# CRIAS - Credit Risk Intelligence & Advisory System

A full-stack ML-powered credit risk assessment platform. The ML models
(prediction, SHAP-style explanations, counterfactuals, RCES ranking) run
**natively in Node** — no separate Python service is needed to run the app.
It deploys as a single Vercel project. See [DEPLOY.md](./DEPLOY.md).

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Start MongoDB (local) or use an Atlas URI
```bash
mongod
```

### 2. Configure environment
```bash
cd crias
cp backend/.env.example backend/.env   # then edit MONGODB_URI + JWT_SECRET
```

### 3. Start the app (frontend + API + ML together)
```bash
npm install
npm run dev
```

### 4. Access the App
Open http://localhost:3000/pages/login.html

> Python is only needed to *regenerate* `backend/src/ml/models.json` from the
> original scikit-learn models (see `ai-service/export_models.py`). It is not
> required to run or deploy the app.

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google Sign-In API"
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized origins:
   - `http://localhost:3000` (development)
   - `https://your-app.vercel.app` (production)
6. Copy the Client ID to:
   - `backend/.env` → `GOOGLE_CLIENT_ID`
   - `frontend/pages/login.html` → `data-client_id`

## Vercel Deployment

Full step-by-step instructions are in **[DEPLOY.md](./DEPLOY.md)**. In short:

1. Create a MongoDB Atlas cluster (allow access from `0.0.0.0/0`).
2. Import the repo into Vercel, set **Root Directory = `crias`**.
3. Add env vars: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`.
4. Deploy, then bootstrap an admin with `backend/scripts/createAdmin.js`.

There is **no separate AI service to deploy** — the ML runs in the Node backend.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Chart.js
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **ML engine**: In-process JavaScript (`backend/src/ml`), ported from the
  scikit-learn models and validated to match `predict_proba` to < 1e-9
- **Auth**: JWT + bcrypt + Google OAuth (optional)

## Features

- ✅ User authentication (email + Google OAuth)
- ✅ Role-based access control (analyst, manager, admin)
- ✅ Firm management with financial data
- ✅ ML prediction (3 models: LR, RF, GradientBoosting)
- ✅ SHAP explanations
- ✅ Counterfactual scenarios (DiCE)
- ✅ RCES strategy ranking
- ✅ Admin panel

## Environment Variables

See `backend/.env.example` for the full annotated list. Core variables:

```
MONGODB_URI=mongodb://localhost:27017/crias   # required (Atlas SRV in prod)
JWT_SECRET=<64+ char random string>           # required
NODE_ENV=development                          # production on Vercel
JWT_EXPIRY=24h                                # optional
BCRYPT_ROUNDS=10                              # optional
CORS_ORIGIN=                                  # optional (unset = same-origin)
GOOGLE_CLIENT_ID=                             # optional (enables Google Sign-In)
```

> `AI_SERVICE_URL` is no longer used — the ML engine runs in-process.

## License
MIT
