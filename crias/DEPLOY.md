# 🚀 CRIAS Deployment Guide

## Deploy to Railway (Free Tier) - 15 minutes

---

## Step 1: Create MongoDB Atlas Database (5 min)

1. Go to **https://cloud.mongodb.com** → Sign up (free)
2. Create a **FREE shared cluster** (M0)
3. Go to **Database Access** → **Add Database User**:
   - Username: `crias_user`
   - Password: Generate & **SAVE IT**
4. Go to **Network Access** → **Add IP Address** → **Allow Access from Anywhere**
5. Go to **Database** → **Connect** → **Connect your application**
6. Copy connection string:
   ```
   mongodb+srv://crias_user:<password>@cluster0.xxxxx.mongodb.net/crias
   ```
   Replace `<password>` with your password

---

## Step 2: Push to GitHub (2 min)

```bash
cd /Users/apple/Desktop/CRIAS

# Create repo at https://github.com/new → name it "crias"
git remote add origin https://github.com/YOUR_USERNAME/crias.git
git push -u origin main
```

---

## Step 3: Deploy on Railway (8 min)

### 3A: Create Project & Deploy AI Service

1. Go to **https://railway.app** → Sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `crias` repo
4. Click the service → **Settings**:
   - **Root Directory**: `crias/ai-service`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
5. **Variables** tab → Add:
   ```
   FLASK_ENV=production
   ```
6. **Settings** → **Networking** → **Generate Domain**
7. 📋 **Copy the AI URL** (e.g., `https://crias-ai-xxx.railway.app`)

### 3B: Deploy Backend

1. In same project → **New** → **GitHub Repo** → Select `crias` again
2. Click the NEW service → **Settings**:
   - **Root Directory**: `crias/backend`
   - **Start Command**: `node server.js`
3. **Variables** tab → Add all:
   ```
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=mongodb+srv://crias_user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/crias
   JWT_SECRET=change-this-to-a-random-64-character-secret-key-here
   AI_SERVICE_URL=https://YOUR-AI-SERVICE-URL.railway.app
   CORS_ORIGIN=https://YOUR-BACKEND-URL.railway.app
   ```
4. **Settings** → **Networking** → **Generate Domain**
5. 📋 **Copy your app URL!**

### 3C: Update CORS

1. Go back to Backend **Variables**
2. Update `CORS_ORIGIN` with the backend URL you just generated

---

## ✅ Done!

Your app is live at: **https://YOUR-BACKEND.railway.app**

| Page | URL |
|------|-----|
| Login | `/pages/login.html` |
| Register | `/pages/register.html` |
| Dashboard | `/pages/dashboard.html` |

---

## 🔧 Troubleshooting

| Issue | Fix |
|-------|-----|
| MongoDB error | Check password in connection string |
| AI service 500 | Check AI service logs in Railway |
| CORS error | Verify CORS_ORIGIN matches exactly |
| Build fails | Check root directory is correct |

---

## 💰 Cost: FREE

- Railway: $5/month free credit (plenty for this app)
- MongoDB Atlas: Free tier (512MB)
