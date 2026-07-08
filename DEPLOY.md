# 🚀 CRIAS Deployment Guide (Vercel)

CRIAS now deploys as a **single Vercel project**. The frontend (static files) and
the backend API (Express serverless function) ship together, and the ML models
run **in-process in Node** — there is no separate Python service to host.

You only need two things: a **MongoDB Atlas** database and a **Vercel** account.

---

## Architecture on Vercel

```
                ┌──────────────────────── Vercel ────────────────────────┐
Browser  ──►    │  /            → frontend/pages/login.html  (static CDN)  │
                │  /pages/*, /css/*, /js/*  → static files    (static CDN)  │
                │  /api/*       → api/index.js  → Express app (serverless)  │
                │                   └─ backend/src/ml  (JS ML engine)       │
                └──────────────────────────────┬──────────────────────────┘
                                                │
                                          MongoDB Atlas
```

The app lives at the **repository root** (no nested folder):

- `api/index.js` — serverless entry that exports the Express app.
- `backend/` — API, auth, models, and the JS ML engine (`src/ml`).
- `frontend/` — static HTML/CSS/JS served from Vercel's CDN.
- `vercel.json` — routes `/api/*` to the function, everything else to static.

---

## Step 1 — Create a MongoDB Atlas database (5 min)

1. Go to **https://cloud.mongodb.com** and sign up (free).
2. Create a **free M0 shared cluster**.
3. **Database Access → Add Database User**: create a user + password (save it).
4. **Network Access → Add IP Address → Allow Access from Anywhere** (`0.0.0.0/0`).
   Vercel's serverless IPs are dynamic, so this is required.
5. **Database → Connect → Drivers**, copy the connection string and add the DB name:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/crias?retryWrites=true&w=majority
   ```

---

## Step 2 — Push the cleaned repo to GitHub (2 min)

Secrets and `node_modules` are now git-ignored. From the repo root:

```bash
git add -A
git commit -m "Production-ready: in-process ML, serverless backend, secrets removed"
git push
```

> ⚠️ The old dev `JWT_SECRET` was previously committed to git history. It is now
> untracked, but treat it as compromised — use a fresh secret in production (below).

---

## Step 3 — Import the project into Vercel (3 min)

1. Go to **https://vercel.com/new** and import your GitHub repo.
2. **Root Directory**: leave it as the **repository root** (the default `./`) —
   `vercel.json` and `package.json` are at the root now, so no change is needed.
3. Framework / Application Preset: choose **Other** (NOT "Services").
   Leave build/output/install settings empty (vercel.json handles it).
4. Add the environment variables in Step 4 **before** clicking Deploy.

---

## Step 4 — Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable          | Required | Value                                                                 |
|-------------------|----------|-----------------------------------------------------------------------|
| `MONGODB_URI`     | ✅       | Your Atlas SRV string from Step 1                                     |
| `JWT_SECRET`      | ✅       | A 64+ char random string (see below)                                  |
| `NODE_ENV`        | ✅       | `production`                                                          |
| `JWT_EXPIRY`      | ⬜       | `24h` (default)                                                       |
| `BCRYPT_ROUNDS`   | ⬜       | `10` (default)                                                        |
| `CORS_ORIGIN`     | ⬜       | Leave unset (same-origin). Set to your domain to restrict.            |
| `GOOGLE_CLIENT_ID`| ⬜       | Only if you enable Google Sign-In (Step 6)                            |

Generate a fresh `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
A ready-to-use one (rotate anytime):
```
e14ca5b84ee4d5a05822723d763f856c252bbfd46701a47ac4f0de33ac0554bff765cbfede98e91b04fa9c5e6e98ab8b
```

> `AI_SERVICE_URL` is **no longer used** — the ML runs in Node.

Click **Deploy**.

---

## Step 5 — Create the first admin user

Registration creates `analyst` accounts. To get an admin, run the bootstrap
script once against your Atlas DB (from the repo root locally):

```bash
# install deps once
npm install
# create the admin (set MONGODB_URI first, or put it in a local .env)
MONGODB_URI="your-atlas-uri" node backend/scripts/createAdmin.js "Your Name" you@example.com "StrongPass123"
```

If the email already exists it is promoted to admin. Then log in at `/pages/login.html`.

---

## Step 6 — (Optional) Enable Google Sign-In

The Google button is hidden until you configure a real Client ID.

1. In **Google Cloud Console**, create an OAuth 2.0 **Web** client.
2. Authorized JavaScript origins: `https://your-app.vercel.app`.
3. Put the Client ID in **two** places:
   - Vercel env var `GOOGLE_CLIENT_ID`
   - `frontend/pages/login.html` → `data-client_id="..."`
4. Redeploy. The button now appears.

---

## Verify the deployment

| Check | Expected |
|-------|----------|
| `GET https://your-app.vercel.app/api/health` | `{"status":"ok","db":"connected",...}` |
| `/` | Login page loads |
| Register → create firm → submit data → analyze | PD score + SHAP chart + strategies render |

---

## Local development

```bash
# from the repo root
npm install                 # installs deps
# create backend/.env with at least MONGODB_URI and JWT_SECRET
npm run dev                 # http://localhost:3000/pages/login.html
```

The same app runs locally (Express `listen`) and on Vercel (serverless export).
Add mock firms/predictions with `node backend/scripts/seedMockData.js`.

---

## About the ML models

The Node engine reads `backend/src/ml/models.json` (a 72 KB export of the
original scikit-learn models). It is committed, so nothing extra is needed to
run or deploy. The original Python exporter (`ai-service/export_models.py`) that
produced it — and validated the JS math matches sklearn's `predict_proba` to
< 1e-9 — lives in the git history if you ever need to retrain and re-export.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `503 Database connection failed` | Check `MONGODB_URI` and that Atlas allows `0.0.0.0/0`. |
| `/api/health` shows `db: error` | Same as above; verify user/password in the SRV string. |
| `404: NOT_FOUND` / blank page | Root Directory must be the **repo root** (default), and Application Preset **Other** (not "Services"). |
| Can't reach admin pages | Run the `createAdmin.js` script (Step 5). |
| Google button missing | Expected until `GOOGLE_CLIENT_ID` + `data-client_id` are set. |
