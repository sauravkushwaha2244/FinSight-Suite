import os
import io
import csv
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import Response, PlainTextResponse
from pydantic import BaseModel

from app.auth import get_current_user
from app.db import get_db_connection, DEFAULT_ORG_ID, CANONICAL_CATEGORIES
from app.ml_forecaster import train_forecaster, format_currency_lakh

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["Data Management"])

SAMPLE_CSV_CONTENT = """date,category,amount,roi
2026-01,Marketing,210000,1.40
2026-01,Engineering,360000,1.65
2026-01,Sales,225000,1.25
2026-01,Operations,180000,1.05
2026-01,HR,120000,1.02
2026-01,Legal,80000,1.00
2026-01,R&D,260000,1.55
2026-01,Infrastructure,155000,1.20
2026-01,Customer Support,95000,1.30
2026-01,Administration,60000,0.98
2026-02,Marketing,220000,1.42
2026-02,Engineering,380000,1.68
2026-02,Sales,230000,1.26
2026-02,Operations,185000,1.05
2026-02,HR,122000,1.01
2026-02,Legal,82000,1.00
2026-02,R&D,270000,1.56
2026-02,Infrastructure,160000,1.22
2026-02,Customer Support,98000,1.32
2026-02,Administration,62000,0.97
2026-03,Marketing,230000,1.44
2026-03,Engineering,395000,1.70
2026-03,Sales,240000,1.28
2026-03,Operations,190000,1.06
2026-03,HR,125000,1.03
2026-03,Legal,85000,1.01
2026-03,R&D,280000,1.58
2026-03,Infrastructure,165000,1.23
2026-03,Customer Support,100000,1.35
2026-03,Administration,65000,0.99
"""


def _normalize_period(p_str: str) -> str:
    """Normalize date/period strings to YYYY-MM."""
    s = p_str.strip()
    if len(s) >= 7 and s[4] == "-":
        return s[:7]
    try:
        dt = datetime.fromisoformat(s)
        return dt.strftime("%Y-%m")
    except Exception:
        pass
    return s


def _process_csv_rows(rows: List[Dict[str, str]], org_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    """
    Validates CSV records, inserts into SQLite, updates category benchmarks,
    and triggers ML retrain.
    """
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file contains no data rows.")

    cleaned_records = []
    categories_seen = set()
    periods_seen = set()

    for idx, row in enumerate(rows, start=2):  # 1-indexed header is line 1
        # Find column keys flexibly
        date_val = None
        cat_val = None
        amt_val = None
        roi_val = None

        for k, v in row.items():
            if not k:
                continue
            kl = k.strip().lower()
            if kl in ("date", "period", "month", "time"):
                date_val = v
            elif kl in ("category", "category_name", "department"):
                cat_val = v
            elif kl in ("amount", "spend", "spending", "budget"):
                amt_val = v
            elif kl in ("roi", "actual_roi", "return_on_investment"):
                roi_val = v

        if not date_val or not cat_val or amt_val is None:
            raise HTTPException(
                status_code=400,
                detail=f"Line {idx}: Missing required columns. Must include 'date', 'category', 'amount'."
            )

        period_clean = _normalize_period(date_val)
        cat_clean = cat_val.strip()
        if not cat_clean:
            raise HTTPException(status_code=400, detail=f"Line {idx}: Category cannot be empty.")

        try:
            amt_clean = float(str(amt_val).replace(",", "").replace("₹", "").replace("$", "").strip())
            if amt_clean < 0:
                raise ValueError("Negative amount")
        except Exception:
            raise HTTPException(status_code=400, detail=f"Line {idx}: Invalid amount '{amt_val}'. Must be a positive number.")

        roi_clean = 1.2
        if roi_val is not None and str(roi_val).strip():
            try:
                roi_clean = float(str(roi_val).replace("x", "").strip())
            except Exception:
                roi_clean = 1.2

        cleaned_records.append({
            "period": period_clean,
            "category": cat_clean,
            "amount": amt_clean,
            "actual_roi": roi_clean,
        })
        categories_seen.add(cat_clean)
        periods_seen.add(period_clean)

    conn = get_db_connection()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Step 1: Ensure budget_categories exists for all categories
    cat_id_map = {}
    for cat_name in categories_seen:
        cur = conn.execute(
            "SELECT id FROM budget_categories WHERE org_id = ? AND LOWER(name) = LOWER(?)",
            (org_id, cat_name)
        )
        row = cur.fetchone()
        if row:
            cat_id_map[cat_name] = row["id"]
        else:
            # Auto-create category with sensible limits
            cat_amounts = [r["amount"] for r in cleaned_records if r["category"] == cat_name]
            avg_amt = sum(cat_amounts) / len(cat_amounts) if cat_amounts else 100000.0
            cur = conn.execute(
                """INSERT INTO budget_categories (org_id, name, current_budget, min_spend, max_spend, is_locked, created_at)
                   VALUES (?, ?, ?, ?, ?, 0, ?)""",
                (org_id, cat_name, avg_amt, round(avg_amt * 0.4, 2), round(avg_amt * 2.2, 2), now_iso)
            )
            cat_id_map[cat_name] = cur.lastrowid

    # Step 2: Insert or replace into historical_spend
    inserted_count = 0
    for r in cleaned_records:
        cid = cat_id_map[r["category"]]
        # Delete existing record for same period and category to prevent duplicates
        conn.execute(
            "DELETE FROM historical_spend WHERE org_id = ? AND category_id = ? AND period = ?",
            (org_id, cid, r["period"])
        )
        conn.execute(
            """INSERT INTO historical_spend (category_id, org_id, period, amount, actual_roi, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (cid, org_id, r["period"], r["amount"], r["actual_roi"], now_iso)
        )
        inserted_count += 1

    # Step 3: Update current_budget and base_roi in budget_categories based on latest data
    for cat_name, cid in cat_id_map.items():
        # Latest spend
        cur = conn.execute(
            "SELECT amount FROM historical_spend WHERE category_id = ? ORDER BY period DESC LIMIT 1",
            (cid,)
        )
        latest_row = cur.fetchone()
        if latest_row:
            latest_amt = latest_row["amount"]
            # Average ROI
            cur_roi = conn.execute(
                "SELECT AVG(actual_roi) as avg_roi FROM historical_spend WHERE category_id = ? AND actual_roi IS NOT NULL",
                (cid,)
            )
            roi_row = cur_roi.fetchone()
            avg_roi = round(float(roi_row["avg_roi"]), 2) if roi_row and roi_row["avg_roi"] else 1.2

            conn.execute(
                "UPDATE budget_categories SET current_budget = ? WHERE id = ?",
                (latest_amt, cid)
            )

    conn.commit()
    conn.close()

    # Step 4: Sync to ml_training/data/financial_data.csv for offline tooling compatibility
    base_ml_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "ml_training", "data"))
    csv_out = os.path.join(base_ml_dir, "financial_data.csv")
    try:
        from app.db import get_historical_spend
        all_spend = get_historical_spend(org_id=org_id)
        if all_spend:
            os.makedirs(base_ml_dir, exist_ok=True)
            with open(csv_out, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["category", "period", "amount", "actual_roi"])
                for row in all_spend:
                    writer.writerow([
                        row["category_name"],
                        row["period"],
                        row["amount"],
                        row["actual_roi"] if row.get("actual_roi") else 1.2
                    ])
    except Exception as e:
        logger.warning("Could not sync CSV export: %s", e)

    # Step 5: Retrain XGBoost model with new data
    try:
        ml_metadata = train_forecaster(org_id=org_id)
        metrics = ml_metadata.get("metrics", {})
    except Exception as e:
        logger.warning("Model retraining after upload failed: %s", e)
        metrics = {"error": str(e)}

    return {
        "status": "success",
        "rows_ingested": inserted_count,
        "categories_updated": sorted(list(categories_seen)),
        "periods_covered": sorted(list(periods_seen)),
        "model_metrics": metrics,
        "message": f"Successfully ingested {inserted_count} rows across {len(categories_seen)} departments and retrained XGBoost Forecaster."
    }


from fastapi import Request

@router.post("/upload-csv", summary="Upload financial data CSV")
async def upload_csv(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """
    Upload and validate financial data CSV:
    date,category,amount,roi
    2026-01,Marketing,50000,1.2
    2026-01,Engineering,120000,1.5
    ...
    Ingests to database, updates category metrics, and retrains XGBoost forecaster.
    Supports multipart file upload, json body (csv_text), or raw csv text.
    """
    content_type = request.headers.get("content-type", "")
    csv_content = ""
    org_id = user.get("org_id") or DEFAULT_ORG_ID

    if "multipart/form-data" in content_type:
        form = await request.form()
        file_obj = form.get("file")
        if file_obj and hasattr(file_obj, "read"):
            content_bytes = await file_obj.read()
            csv_content = content_bytes.decode("utf-8-sig", errors="replace")
        elif "csv_text" in form:
            csv_content = str(form["csv_text"])
        if "org_id" in form:
            org_id = str(form["org_id"])
    elif "application/json" in content_type:
        try:
            body = await request.json()
            csv_content = body.get("csv_text") or body.get("csv") or ""
            if body.get("org_id"):
                org_id = body.get("org_id")
        except Exception:
            pass
    else:
        body_bytes = await request.body()
        csv_content = body_bytes.decode("utf-8-sig", errors="replace")

    if not csv_content.strip():
        raise HTTPException(status_code=400, detail="No CSV data or file uploaded.")

    reader = csv.DictReader(io.StringIO(csv_content))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV contains no records or invalid format.")

    return _process_csv_rows(rows, org_id=org_id)


@router.get("/sample-csv", summary="Download standard CSV template")
def get_sample_csv():
    """Returns downloadable sample CSV template for testing."""
    return PlainTextResponse(
        content=SAMPLE_CSV_CONTENT,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="finsight_sample_financial_data.csv"'}
    )
