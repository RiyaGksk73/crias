# CRIAS - Credit Risk Intelligence & Advisory System

A full-stack ML-powered credit risk assessment platform.

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Python 3.9+
- MongoDB (local or Atlas)

### 1. Start MongoDB
```bash
mongod
```

### 2. Start Backend
```bash
cd crias/backend
npm install
npm start
```

### 3. Start AI Service
```bash
cd crias/ai-service
pip install -r requirements.txt
python app.py
```

### 4. Access the App
Open http://localhost:3000/pages/login.html

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

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Set up Environment Variables
In Vercel dashboard, add these secrets:
- `mongodb_uri` - MongoDB Atlas connection string
- `jwt_secret` - 64+ character secret key
- `google_client_id` - Google OAuth client ID
- `ai_service_url` - URL of deployed AI service

### 3. Deploy
```bash
cd crias
vercel
```

### AI Service Deployment
The Python AI service needs to be deployed separately:

**Option A: Railway.app**
```bash
cd ai-service
railway init
railway up
```

**Option B: Render.com**
- Connect GitHub repo
- Set build command: `pip install -r requirements.txt`
- Set start command: `gunicorn app:app`

**Option C: Use Vercel Serverless (limited)**
Convert to Vercel Python functions (recommended for simple cases)

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Chart.js
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **AI Service**: Python, Flask, scikit-learn, SHAP
- **Auth**: JWT + bcrypt + Google OAuth

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

### Backend (.env)
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/crias
JWT_SECRET=your-64-char-secret
JWT_EXPIRY=24h
AI_SERVICE_URL=http://localhost:5001
GOOGLE_CLIENT_ID=your-google-client-id
CORS_ORIGIN=http://localhost:3000
```

### AI Service (.env)
```
FLASK_PORT=5001
FLASK_ENV=development
```

## License
MIT
