import os
import sys
import math
import random
import logging
from datetime import datetime, timedelta
import pandas as pd
from dotenv import load_dotenv

# Ensure backend package is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db import seed_database, init_db, DEFAULT_ORG_ID, DEFAULT_ORG_NAME, CANONICAL_CATEGORIES, CANONICAL_PRIORITIES

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("seed")


def seed():
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    supabase = None
    if url and key and "YOUR-PROJECT-REF" not in url:
        try:
            from supabase import create_client
            supabase = create_client(url, key)
            logger.info("Connected to Supabase. Seeding Supabase database...")
        except Exception as e:
            logger.warning(f"Could not connect to Supabase: {e}. Proceeding with local DB.")
            supabase = None
    else:
        logger.info("Supabase credentials not configured or demo mode. Seeding local database.")

    # 1. Seed local SQLite database (always ensured)
    init_db(force_reseed=True)
    logger.info("✓ Local SQLite database fully populated with ABC Technologies hierarchy.")

    # 2. If Supabase is available, populate Supabase relational hierarchy
    if supabase:
        try:
            org_id = DEFAULT_ORG_ID
            now_iso = datetime.utcnow().isoformat()

            # Insert Organization
            logger.info("Inserting Organization into Supabase: %s (%s)", DEFAULT_ORG_NAME, org_id)
            supabase.table("organizations").upsert({
                "id": org_id,
                "name": DEFAULT_ORG_NAME,
                "fiscal_year_start": 1,
                "currency": "INR"
            }).execute()

            # Insert Budget Categories & collect returned IDs
            logger.info("Inserting 10 Budget Categories into Supabase...")
            cat_map = {}
            for cat in CANONICAL_CATEGORIES:
                res = supabase.table("budget_categories").upsert({
                    "org_id": org_id,
                    "name": cat["name"],
                    "min_spend": cat["min_spend"],
                    "max_spend": cat["max_spend"],
                    "is_locked": bool(cat["is_locked"]),
                }, on_conflict="org_id,name").execute()
                if res.data:
                    cat_map[cat["name"]] = res.data[0]["id"]

            # If Supabase auto-generated UUIDs, fetch them
            if len(cat_map) < len(CANONICAL_CATEGORIES):
                res = supabase.table("budget_categories").select("id, name").eq("org_id", org_id).execute()
                for item in res.data:
                    cat_map[item["name"]] = item["id"]

            # Generate 24 months spending
            months = []
            for y in [2024, 2025]:
                for m in range(1, 13):
                    months.append(f"{y}-{m:02d}")

            spend_records = []
            for cat_idx, cat in enumerate(CANONICAL_CATEGORIES):
                cat_name = cat["name"]
                cat_id = cat_map.get(cat_name)
                if not cat_id:
                    continue
                base_budget = cat["current_budget"]
                base_roi = cat["base_roi"]

                for m_idx, month in enumerate(months):
                    growth = 1.0 + (m_idx * 0.006)
                    seasonal = math.sin((m_idx + cat_idx * 2) * 0.8) * 0.09
                    amt = round(base_budget * (growth + seasonal), 2)
                    roi = round(max(0.5, base_roi + math.cos(m_idx * 0.5 + cat_idx) * 0.22), 2)

                    spend_records.append({
                        "category_id": cat_id,
                        "org_id": org_id,
                        "period": month,
                        "amount": amt,
                        "actual_roi": roi,
                    })

            if spend_records:
                logger.info("Inserting %d historical spend records into Supabase...", len(spend_records))
                chunk_size = 100
                for i in range(0, len(spend_records), chunk_size):
                    supabase.table("historical_spend").upsert(spend_records[i:i + chunk_size]).execute()

            # Insert Business Priorities
            logger.info("Inserting Business Priorities into Supabase...")
            priorities = [
                {
                    "org_id": org_id,
                    "period": "Q4 2026",
                    "priority_name": p[0],
                    "weight": p[1],
                }
                for p in CANONICAL_PRIORITIES
            ]
            supabase.table("business_priorities").upsert(priorities, on_conflict="org_id,period,priority_name").execute()

            # Insert Risk Indicators
            logger.info("Inserting Risk Indicators into Supabase...")
            indicator_defs = [
                ("liquidity", 34.0, "Financial Reserves"),
                ("budget_variance", 55.0, "Spend Tracking"),
                ("vendor_concentration", 81.0, "Supply Chain"),
                ("forecast_deviation", 38.0, "Predictive Analytics"),
                ("volatility", 72.0, "Variance Analysis"),
            ]
            risk_records = []
            for m in months[-6:] + ["Q4 2026"]:
                for ind_type, base_val, cat_n in indicator_defs:
                    shift = math.sin(len(m) + hash(ind_type) % 7) * 4.0
                    val = round(max(5.0, min(95.0, base_val + (0 if m == "Q4 2026" else shift))), 1)
                    risk_records.append({
                        "org_id": org_id,
                        "indicator_type": ind_type,
                        "category": cat_n,
                        "value": val,
                        "period": m,
                        "source": "ERP Ledger / Automated Ingestion",
                    })

            for i in range(0, len(risk_records), chunk_size):
                supabase.table("risk_indicators").upsert(risk_records[i:i + chunk_size]).execute()

            logger.info("✓ Supabase data population completed successfully.")
        except Exception as e:
            logger.warning("Supabase seed encounter an issue: %s. Local SQLite remains fully populated.", e)

    # 3. Verify ML CSV
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base_dir, "ml_training", "data", "financial_data.csv")
    if os.path.isfile(csv_path):
        df = pd.read_csv(csv_path)
        logger.info("✓ Verified %s with %d records across %d categories.", csv_path, len(df), df["category"].nunique())


if __name__ == "__main__":
    seed()
