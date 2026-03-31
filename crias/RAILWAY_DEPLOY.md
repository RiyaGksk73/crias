# CRIAS Monorepo - Railway Deployment

This project contains two services that need to be deployed separately on Railway.

## Services

1. **backend/** - Node.js Express API
2. **ai-service/** - Python Flask ML Service

## Deployment Steps

### Option 1: Deploy from GitHub (Recommended)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app)
3. Create a new project
4. Add services from repo:
   - Service 1: Select `backend/` directory
   - Service 2: Select `ai-service/` directory
5. Add MongoDB (Railway plugin) or use MongoDB Atlas
6. Set environment variables for each service

### Option 2: Deploy via CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy Backend
cd backend
railway init
railway up

# Deploy AI Service  
cd ../ai-service
railway init
railway up
```

## Environment Variables

### Backend Service
```
PORT=3000
MONGODB_URI=<your-mongodb-uri>
JWT_SECRET=<64-char-secret>
JWT_EXPIRY=24h
AI_SERVICE_URL=<ai-service-railway-url>
GOOGLE_CLIENT_ID=<your-google-client-id>
CORS_ORIGIN=<your-frontend-url>
NODE_ENV=production
```

### AI Service
```
PORT=5001
FLASK_ENV=production
```

## Post-Deployment

1. Copy the AI service URL from Railway
2. Update backend's `AI_SERVICE_URL` environment variable
3. Update `CORS_ORIGIN` with your frontend URL
4. Test the health endpoints:
   - Backend: `https://<backend-url>/api/health`
   - AI: `https://<ai-url>/health`
