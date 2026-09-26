# FinSight Suite — Financial Intelligence Platform

Budget Optimization Engine + Financial Risk Intelligence Dashboard with separate ML training pipeline.

## Architecture

```
                 ┌──────────────────┐
                 │  Next.js Frontend│
                 │  (React/Recharts)│
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │  FastAPI Backend  │
                 │  (Python 3.11+)  │
                 └────────┬─────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  Supabase  │  │   Celery   │  │  ML Model  │
   │ (Postgres) │  │  + Redis   │  │   (.pkl)   │
   └────────────┘  └────────────┘  └────────────┘
                                          ▲
                                          │
                              ┌───────────┴──────────┐
                              │  ml_training/         │
                              │  (offline, separate)  │
                              └──────────────────────┘
```

## Features

- **Budget Optimization** — Constrained optimization (scipy) with conservative/balanced/aggressive scenarios
- **Risk Intelligence** — Composite risk scoring across 5 indicator categories with real-time alerts
- **ML Forecasting** — XGBoost spend forecasting, trained offline, served via API
- **Supabase Auth** — Email + OAuth, JWT verification, Row-Level Security
- **Real-time Alerts** — Supabase Realtime subscriptions for risk alerts
- **Celery Scheduling** — Nightly recalculation of risk scores and budget recommendations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS, Recharts, Lucide Icons |
| Backend | FastAPI, Python 3.11+, Pydantic v2 |
| Database | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| ML Training | XGBoost, scikit-learn, pandas |
| Task Queue | Celery + Redis |
| Auth | Supabase Auth (JWT) |

## Project Structure

```
finsight-suite/
├── supabase/migrations/001_schema.sql   # Database schema + RLS
├── backend/
│   ├── app/
│   │   ├── config.py                    # Environment config
│   │   ├── auth.py                      # JWT verification
│   │   ├── supabase_client.py           # DB client wrapper
│   │   ├── optimizer.py                 # Budget optimization (scipy)
│   │   ├── risk_scorer.py               # Composite risk scoring
│   │   ├── ml_inference.py              # Load & predict from .pkl
│   │   ├── scheduler.py                 # Celery nightly tasks
│   │   └── routes/
│   │       ├── budget.py                # /budget/* endpoints
│   │       ├── risk.py                  # /risk/* endpoints
│   │       └── ml.py                    # /ml/* endpoints
│   ├── main.py                          # FastAPI entry point
│   ├── seed.py                          # Sample data generator
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                         # Next.js pages (7 routes)
│   │   ├── components/                  # 8 reusable components
│   │   └── lib/                         # Supabase + API helpers
│   ├── package.json
│   └── tailwind.config.js
├── ml_training/                         # COMPLETELY SEPARATE
│   ├── preprocessing/feature_engineering.py
│   ├── train_model.py
│   ├── evaluate_model.py
│   ├── data/                            # Raw + processed CSV
│   ├── models/                          # Trained .pkl output
│   └── requirements.txt
├── .env.example
└── .gitignore
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (backend only) |
| `REDIS_URL` | Redis connection URL for Celery |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL (frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY (frontend) |
| `NEXT_PUBLIC_API_URL` | Backend URL (default: http://localhost:8000) |

## Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the schema migration in the Supabase SQL Editor:

```sql
-- Copy and paste contents of supabase/migrations/001_schema.sql
```

3. Enable Realtime on the `risk_alerts` table (already in migration)
4. Create a Storage bucket named `ml-models`

## Seed Sample Data

```bash
cd backend
pip install -r requirements.txt
python seed.py
```

This creates: 1 org, 10 budget categories, 24 months of historical spend, business priorities, risk indicators, and exports `ml_training/data/financial_data.csv`.

## ML Training (Offline — Separate)

```bash
cd ml_training
pip install -r requirements.txt

# Step 1: Engineer features from raw data
python preprocessing/feature_engineering.py

# Step 2: Train models (XGBoost + RF + GBR), selects best
python train_model.py

# Step 3: Evaluate on test set
python evaluate_model.py
```

**Output:** `models/spend_forecast_model.pkl`, `models/scaler.pkl`, `models/model_metadata.json`

Upload the model to Supabase Storage bucket `ml-models/` and activate it via the admin UI or API.

> **CRITICAL:** ML training is completely independent. Never import from `backend/` or `frontend/`. Never train during API requests.

## Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on `http://localhost:8000`. API docs at `/docs`.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/budget/optimize` | Run budget optimization |
| GET | `/budget/recommendations` | Fetch recommendations |
| POST | `/budget/priorities` | Update priority weights |
| GET | `/risk/dashboard` | Aggregated risk view |
| GET | `/risk/alerts` | Active alerts (paginated) |
| POST | `/risk/indicators/ingest` | Ingest indicator data |
| POST | `/risk/alerts/{id}/acknowledge` | Acknowledge alert |
| GET | `/ml/predictions/{org_id}` | Model predictions |
| GET | `/ml/models` | List model versions |
| POST | `/ml/models/activate` | Activate a model |

### Celery Workers (optional)

```bash
# Start worker
celery -A app.scheduler worker --loglevel=info

# Start beat (nightly scheduling)
celery -A app.scheduler beat --loglevel=info
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000`.

### Pages

| Route | Description |
|-------|-------------|
| `/login` | Supabase Auth UI |
| `/dashboard` | Overview with KPIs, charts, alerts |
| `/budget` | Optimization with scenario comparison + manual sliders |
| `/risk` | Risk gauge, indicator breakdown, alert feed |
| `/settings/priorities` | Business priority weights editor |
| `/settings/categories` | Budget category constraints manager |
| `/admin/models` | ML model version management |

## Key Design Decisions

### Budget Optimizer
- Uses `scipy.optimize.minimize` (SLSQP method) with constraints
- Locked categories are fixed; remaining budget is optimized across unlocked
- Three scenarios apply different objective weights (conservative penalizes large changes, aggressive maximizes ROI)

### Risk Scorer
- 5 indicator categories: liquidity, budget_variance, vendor_concentration, forecast_deviation, volatility
- Weighted composite score (0–100), severity: low/medium/high/critical
- Automatic alert generation when thresholds are breached

### ML Pipeline
- Sequential train/test split (no data leakage)
- Compares XGBoost, Random Forest, Gradient Boosting
- Selects best by MAE
- Versioned model artifacts with full metadata

### Security
- All tables have Row-Level Security scoped by `org_id`
- Admin-only writes on categories and priorities
- Service role key used only server-side (never exposed to frontend)
- JWT verified on every protected backend endpoint

## Deployment

### One-Click Deploy (Render Blueprint — Recommended)

Deploy **both frontend + backend + Redis** in a single step:

1. Push this repo to GitHub
2. Go to [render.com/deploy](https://render.com/deploy)
3. Click **"New Blueprint Instance"** → select your repo
4. Render reads `render.yaml` and creates all 3 services automatically
5. Fill in the Supabase env vars when prompted → **Done!**

The `render.yaml` blueprint provisions:
- **finsight-frontend** — Next.js web service
- **finsight-backend** — FastAPI web service
- **finsight-redis** — Redis instance for Celery

### Manual Deploy (Alternative)

#### Frontend (Vercel)
```bash
cd frontend
vercel deploy
```
Set environment variables in Vercel dashboard.

#### Backend (Railway / Render / Fly.io)
```bash
# Railway
railway up

# Or Docker
docker build -t finsight-backend ./backend
docker run -p 8000:8000 finsight-backend
```

### ML Training
Run on any machine with Python 3.11+. Upload model artifacts to Supabase Storage.

## License

MIT
