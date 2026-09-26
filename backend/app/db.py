import sqlite3
import os
import hashlib
import secrets
import json
import math
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "finsight.db")

DEFAULT_ORG_ID = "org-abc-tech"
DEFAULT_ORG_NAME = "ABC Technologies"

# Canonical 10 categories requested for ABC Technologies
CANONICAL_CATEGORIES = [
    {"name": "Marketing", "min_spend": 100000.0, "max_spend": 500000.0, "current_budget": 200000.0, "is_locked": 0, "base_roi": 1.40},
    {"name": "Engineering", "min_spend": 100000.0, "max_spend": 800000.0, "current_budget": 350000.0, "is_locked": 0, "base_roi": 1.65},
    {"name": "Sales", "min_spend": 80000.0, "max_spend": 600000.0, "current_budget": 220000.0, "is_locked": 0, "base_roi": 1.25},
    {"name": "Operations", "min_spend": 60000.0, "max_spend": 400000.0, "current_budget": 180000.0, "is_locked": 1, "base_roi": 1.05},
    {"name": "HR", "min_spend": 40000.0, "max_spend": 300000.0, "current_budget": 120000.0, "is_locked": 0, "base_roi": 1.02},
    {"name": "Legal", "min_spend": 20000.0, "max_spend": 200000.0, "current_budget": 80000.0, "is_locked": 1, "base_roi": 1.00},
    {"name": "R&D", "min_spend": 80000.0, "max_spend": 700000.0, "current_budget": 250000.0, "is_locked": 0, "base_roi": 1.55},
    {"name": "Infrastructure", "min_spend": 50000.0, "max_spend": 350000.0, "current_budget": 150000.0, "is_locked": 0, "base_roi": 1.20},
    {"name": "Customer Support", "min_spend": 30000.0, "max_spend": 250000.0, "current_budget": 90000.0, "is_locked": 0, "base_roi": 1.30},
    {"name": "Administration", "min_spend": 20000.0, "max_spend": 150000.0, "current_budget": 60000.0, "is_locked": 0, "base_roi": 0.98},
]

CANONICAL_PRIORITIES = [
    ("Growth", 30.0, "Market share expansion and customer acquisition"),
    ("Profitability", 25.0, "Gross margin optimization and unit economics"),
    ("Innovation", 20.0, "Core product development and AI engineering capabilities"),
    ("Efficiency", 15.0, "Operational streamlining and automation"),
    ("Compliance", 10.0, "Regulatory compliance, data security, and governance"),
]


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return hashed.hex(), salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(new_hash, hashed)


def init_db(force_reseed: bool = False):
    """Initializes tables and seeds initial data if database is new or force_reseed is True."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        fiscal_year_start INTEGER DEFAULT 1,
        currency TEXT DEFAULT 'INR',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        org_id TEXT NOT NULL DEFAULT 'org-abc-tech',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        current_budget REAL NOT NULL DEFAULT 0,
        min_spend REAL NOT NULL DEFAULT 0,
        max_spend REAL NOT NULL DEFAULT 0,
        is_locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS historical_spend (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        org_id TEXT NOT NULL,
        period TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        actual_roi REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS business_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'Q4 2026',
        priority_name TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0,
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL,
        period TEXT NOT NULL,
        category_id INTEGER,
        category_name TEXT NOT NULL,
        current_budget REAL NOT NULL DEFAULT 0,
        recommended_budget REAL NOT NULL DEFAULT 0,
        projected_impact TEXT,
        confidence REAL DEFAULT 0.90,
        scenario_type TEXT DEFAULT 'balanced',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_indicators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL,
        indicator_type TEXT NOT NULL,
        category TEXT,
        value REAL NOT NULL,
        period TEXT NOT NULL DEFAULT 'Q4 2026',
        source TEXT DEFAULT 'Internal Ledger',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL,
        period TEXT NOT NULL,
        composite_score REAL NOT NULL,
        breakdown_json TEXT NOT NULL DEFAULT '{}',
        severity TEXT DEFAULT 'low',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_alerts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        indicator_type TEXT NOT NULL,
        message TEXT NOT NULL,
        threshold_breached TEXT,
        period TEXT NOT NULL DEFAULT 'Q4 2026',
        acknowledged INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_narratives (
        alert_id TEXT PRIMARY KEY,
        headline TEXT NOT NULL,
        explanation TEXT NOT NULL,
        recommended_action TEXT NOT NULL,
        action_category TEXT NOT NULL,
        estimated_cost REAL DEFAULT 0,
        urgency TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cat_org ON budget_categories(org_id);
    CREATE INDEX IF NOT EXISTS idx_spend_cat ON historical_spend(category_id);
    CREATE INDEX IF NOT EXISTS idx_spend_period ON historical_spend(org_id, period);
    CREATE INDEX IF NOT EXISTS idx_prio_org ON business_priorities(org_id, period);
    CREATE INDEX IF NOT EXISTS idx_risk_ind_org ON risk_indicators(org_id, period);
    CREATE INDEX IF NOT EXISTS idx_alerts_org ON risk_alerts(org_id, acknowledged);
    """)

    cursor.execute("SELECT COUNT(*) as count FROM budget_categories WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cat_count = cursor.fetchone()["count"]

    if cat_count == 0 or force_reseed:
        seed_database(conn)
    else:
        conn.commit()

    conn.close()


def seed_database(conn: Optional[sqlite3.Connection] = None):
    """Populates the database with the complete demo organization (ABC Technologies) and all related entities."""
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True

    cursor = conn.cursor()
    now_iso = datetime.utcnow().isoformat()

    logger.info("Seeding database with ABC Technologies demo organization and canonical dataset...")

    # 1. Clear existing demo data for clean reseed
    cursor.execute("DELETE FROM alert_narratives")
    cursor.execute("DELETE FROM risk_alerts WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cursor.execute("DELETE FROM risk_scores WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cursor.execute("DELETE FROM risk_indicators WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cursor.execute("DELETE FROM budget_recommendations WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cursor.execute("DELETE FROM business_priorities WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cursor.execute("DELETE FROM historical_spend WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cursor.execute("DELETE FROM budget_categories WHERE org_id = ?", (DEFAULT_ORG_ID,))
    cursor.execute("DELETE FROM organizations WHERE id = ?", (DEFAULT_ORG_ID,))

    # 2. Insert Organization
    cursor.execute(
        """INSERT INTO organizations (id, name, fiscal_year_start, currency, created_at)
           VALUES (?, ?, 1, 'INR', ?)""",
        (DEFAULT_ORG_ID, DEFAULT_ORG_NAME, now_iso)
    )

    # 3. Insert or update Admin User
    pwd_hash, salt = hash_password("admin123")
    cursor.execute(
        """INSERT OR REPLACE INTO users (id, email, password_hash, salt, full_name, role, org_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        ("usr-admin-1", "admin@finsight.com", pwd_hash, salt, "FinSight Administrator", "admin", DEFAULT_ORG_ID, now_iso)
    )

    # 4. Insert 10 Categories
    category_id_map = {}
    for cat in CANONICAL_CATEGORIES:
        cursor.execute(
            """INSERT INTO budget_categories (org_id, name, current_budget, min_spend, max_spend, is_locked, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (DEFAULT_ORG_ID, cat["name"], cat["current_budget"], cat["min_spend"], cat["max_spend"], cat["is_locked"], now_iso)
        )
        cat_id = cursor.lastrowid
        category_id_map[cat["name"]] = cat_id

    # 5. Insert 24 Months of Historical Spend (2024-01 to 2025-12 = 24 months)
    months = []
    for y in [2024, 2025]:
        for m in range(1, 13):
            months.append(f"{y}-{m:02d}")

    spend_rows = []
    csv_records = []
    for cat_idx, cat in enumerate(CANONICAL_CATEGORIES):
        cat_name = cat["name"]
        cat_id = category_id_map[cat_name]
        base_budget = cat["current_budget"]
        base_roi = cat["base_roi"]

        for m_idx, month in enumerate(months):
            # Deterministic, realistic financial variance (±12%) with slight positive trend
            growth_trend = 1.0 + (m_idx * 0.006)
            seasonal_var = math.sin((m_idx + cat_idx * 2) * 0.8) * 0.09
            amount = round(base_budget * (growth_trend + seasonal_var), 2)
            roi = round(max(0.5, base_roi + math.sin(m_idx * 0.5 + cat_idx) * 0.04), 2)

            spend_rows.append((cat_id, DEFAULT_ORG_ID, month, amount, roi, now_iso))
            csv_records.append({
                "category": cat_name,
                "period": month,
                "amount": amount,
                "actual_roi": roi,
            })

    cursor.executemany(
        """INSERT INTO historical_spend (category_id, org_id, period, amount, actual_roi, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        spend_rows
    )

    # 6. Insert Business Priorities (sum to 100.0)
    priority_rows = [
        (DEFAULT_ORG_ID, "Q4 2026", p[0], p[1], p[2], now_iso)
        for p in CANONICAL_PRIORITIES
    ]
    cursor.executemany(
        """INSERT INTO business_priorities (org_id, period, priority_name, weight, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        priority_rows
    )

    # 7. Insert Risk Indicators (Q4 2026 + recent historical months)
    # Real financial metrics:
    # - Liquidity: Current ratio (Assets / Liabilities) = 1.8x
    # - Budget Variance: Spend drift relative to baseline = 12.0%
    # - Vendor Concentration: Top 3 suppliers share of spend = 45.0%
    # - Forecast Deviation: Mean Absolute Percentage Error (MAPE) = 8.0%
    # - Volatility: Coefficient of variation of monthly burn = 20.0%
    indicator_definitions = [
        ("liquidity", 1.8, "Financial Reserves"),
        ("budget_variance", 12.0, "Spend Tracking"),
        ("vendor_concentration", 45.0, "Supply Chain"),
        ("forecast_deviation", 8.0, "Predictive Analytics"),
        ("volatility", 20.0, "Variance Analysis"),
    ]

    indicator_rows = []
    for m in months[-6:] + ["Q4 2026"]:
        for ind_type, base_val, category_name in indicator_definitions:
            if m == "Q4 2026":
                val = base_val
            elif ind_type == "liquidity":
                shift = math.sin(len(m) + hash(ind_type) % 7) * 0.15
                val = round(max(0.9, min(2.5, base_val + shift)), 2)
            else:
                shift = math.sin(len(m) + hash(ind_type) % 7) * 3.0
                val = round(max(2.0, min(80.0, base_val + shift)), 1)
            indicator_rows.append((DEFAULT_ORG_ID, ind_type, category_name, val, m, "ERP Ledger / Automated Ingestion", now_iso))

    cursor.executemany(
        """INSERT INTO risk_indicators (org_id, indicator_type, category, value, period, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        indicator_rows
    )

    # 8. Insert Pre-calculated Standardized Risk Score for Q4 2026
    # Liquidity 1.8x -> 28.0 (Low/Moderate)
    # Budget Variance 12% -> 37.5 (Moderate)
    # Vendor Concentration 45% -> 45.0 (Moderate)
    # Forecast Deviation 8% -> 28.5 (Low/Moderate)
    # Volatility 20% -> 33.3 (Moderate)
    # Weighted composite: 0.25*28 + 0.25*37.5 + 0.15*45 + 0.20*28.5 + 0.15*33.3 = 33.8 -> 34 / 100 (MEDIUM)
    breakdown = {
        "liquidity": 28.0,
        "budget_variance": 37.5,
        "vendor_concentration": 45.0,
        "forecast_deviation": 28.5,
        "volatility": 33.3,
    }
    cursor.execute(
        """INSERT INTO risk_scores (org_id, period, composite_score, breakdown_json, severity, created_at)
           VALUES (?, 'Q4 2026', 33.8, ?, 'medium', ?)""",
        (DEFAULT_ORG_ID, json.dumps(breakdown), now_iso)
    )

    # 9. Insert Realistic Risk Alerts
    alerts = [
        (
            "alert-001",
            DEFAULT_ORG_ID,
            "critical",
            "Vendor Concentration",
            "Vendor concentration risk exceeds 80% threshold — top suppliers represent critical exposure in Infrastructure and Marketing.",
            "Vendor score 81.0 exceeds threshold 80.0",
            "Q4 2026",
            0,
            (datetime.utcnow() - timedelta(minutes=25)).isoformat()
        ),
        (
            "alert-002",
            DEFAULT_ORG_ID,
            "high",
            "Liquidity",
            "Liquidity ratio approaching minimum acceptable buffer. Review payable schedules and cash reserve targets.",
            "Liquidity score 34.0 below minimum safe buffer (40.0)",
            "Q4 2026",
            0,
            (datetime.utcnow() - timedelta(hours=1, minutes=15)).isoformat()
        ),
        (
            "alert-003",
            DEFAULT_ORG_ID,
            "high",
            "Volatility",
            "Expense volatility elevated in Infrastructure and Operations. Run SLSQP scenario stress test.",
            "Volatility index 72.0 indicates elevated variance",
            "Q4 2026",
            0,
            (datetime.utcnow() - timedelta(hours=3, minutes=30)).isoformat()
        ),
        (
            "alert-004",
            DEFAULT_ORG_ID,
            "medium",
            "Budget Variance",
            "Marketing spend trending 12% above projected quarterly baseline. Optimization reallocation advised.",
            "Budget variance 55.0 points to tracking drift",
            "Q4 2026",
            0,
            (datetime.utcnow() - timedelta(hours=7)).isoformat()
        ),
        (
            "alert-005",
            DEFAULT_ORG_ID,
            "low",
            "Forecast Deviation",
            "Forecast deviation within acceptable limits (+/- 5%). ML inference confidence remains strong (0.94).",
            "Forecast deviation 38.0 within safe zone (< 45.0)",
            "Q4 2026",
            1,
            (datetime.utcnow() - timedelta(days=1)).isoformat()
        ),
    ]

    cursor.executemany(
        """INSERT INTO risk_alerts (id, org_id, severity, indicator_type, message, threshold_breached, period, acknowledged, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        alerts
    )

    # 10. Insert Grounded Alert Narratives
    narratives = [
        (
            "alert-001",
            "Critical Vendor Exposure in Cloud Infrastructure & Digital Marketing",
            "ABC Technologies relies heavily on AWS and two major ad exchanges, accounting for 81.0% of external supplier payments. A disruption or rate increase would directly impact Q4 gross margins.",
            "Diversify secondary cloud workloads to multi-cloud reserved instances and renegotiate annual marketing retainer commitments.",
            "vendor_diversification",
            25000.0,
            "critical",
            "FinSight Risk Intelligence Engine",
            now_iso
        ),
        (
            "alert-002",
            "Operating Liquidity Approaching Near-Term Safe Threshold",
            "Short-term cash buffer has compressed to 34.0 points due to front-loaded R&D tooling expenditures in early Q4.",
            "Reallocate ₹15,000 from discretionary Marketing into the operating liquidity reserve.",
            "liquidity_rebalancing",
            15000.0,
            "high",
            "FinSight Risk Intelligence Engine",
            now_iso
        ),
        (
            "alert-003",
            "Infrastructure and Operations Volatility Index Elevated",
            "Month-over-month infrastructure consumption exhibited sudden 18% spikes in container orchestration and data warehousing.",
            "Institute autoscaling caps and lock minimum operational commitments via optimizer constraints.",
            "operational_containment",
            10000.0,
            "high",
            "FinSight Risk Intelligence Engine",
            now_iso
        ),
    ]

    cursor.executemany(
        """INSERT INTO alert_narratives (alert_id, headline, explanation, recommended_action, action_category, estimated_cost, urgency, generated_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        narratives
    )

    # 11. Insert Default Budget Recommendations for all 10 Categories
    total_curr = sum(c["current_budget"] for c in CANONICAL_CATEGORIES)
    recs = []
    factors = {
        "Marketing": 1.15,
        "Engineering": 1.12,
        "Sales": 1.10,
        "Operations": 1.00,  # locked
        "HR": 0.95,
        "Legal": 1.00,       # locked
        "R&D": 1.14,
        "Infrastructure": 1.05,
        "Customer Support": 1.08,
        "Administration": 0.92,
    }

    for cat in CANONICAL_CATEGORIES:
        name = cat["name"]
        curr = cat["current_budget"]
        rec = round(curr * factors.get(name, 1.05), -2)
        chg = round(((rec - curr) / curr) * 100, 1)
        recs.append((
            DEFAULT_ORG_ID,
            "Q4 2026",
            category_id_map[name],
            name,
            curr,
            rec,
            "Projected +8.4% ROI optimization via SLSQP",
            0.94,
            "balanced",
            now_iso
        ))

    cursor.executemany(
        """INSERT INTO budget_recommendations (org_id, period, category_id, category_name, current_budget, recommended_budget, projected_impact, confidence, scenario_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        recs
    )

    conn.commit()
    logger.info(f"✓ Seed complete: 1 org ({DEFAULT_ORG_NAME}), 10 categories, 240 spend records, 5 priorities, {len(indicator_rows)} indicators, {len(alerts)} alerts.")

    # 12. Also export CSV for ML training pipeline
    try:
        import pandas as pd
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        ml_data_dir = os.path.join(base_dir, "..", "ml_training", "data")
        os.makedirs(ml_data_dir, exist_ok=True)
        csv_path = os.path.join(ml_data_dir, "financial_data.csv")
        pd.DataFrame(csv_records).to_csv(csv_path, index=False)
        logger.info(f"✓ Exported {len(csv_records)} records to {csv_path}")
    except Exception as e:
        logger.warning(f"Could not export CSV for ML: {e}")

    if should_close:
        conn.close()


# ── Query Helpers ─────────────────────────────────────────────────────────────

def _normalize_org_id(org_id: Optional[str]) -> str:
    """Map any demo/default/empty org_id to the canonical ABC Technologies org_id."""
    if not org_id or org_id in ("org-default", "demo-org", "org_1", "default"):
        return DEFAULT_ORG_ID
    return org_id


def get_organization(org_id: str = DEFAULT_ORG_ID) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    row = conn.execute("SELECT * FROM organizations WHERE id = ?", (target_id,)).fetchone()
    conn.close()
    return dict(row) if row else {"id": DEFAULT_ORG_ID, "name": DEFAULT_ORG_NAME, "currency": "INR"}


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(email: str, password: str, full_name: str, role: str = "admin", org_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    email_clean = email.lower().strip()
    existing = get_user_by_email(email_clean)
    if existing:
        raise ValueError("User with this email already exists")

    pwd_hash, salt = hash_password(password)
    user_id = f"usr-{secrets.token_hex(6)}"
    target_org = _normalize_org_id(org_id)
    created_at = datetime.utcnow().isoformat()

    conn = get_db_connection()
    conn.execute(
        """INSERT INTO users (id, email, password_hash, salt, full_name, role, org_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (user_id, email_clean, pwd_hash, salt, full_name.strip(), role, target_org, created_at)
    )
    conn.commit()
    conn.close()

    return {
        "id": user_id,
        "email": email_clean,
        "full_name": full_name.strip(),
        "role": role,
        "org_id": target_org,
        "created_at": created_at
    }


def get_categories(org_id: str = DEFAULT_ORG_ID) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    rows = conn.execute(
        "SELECT id, name, current_budget, min_spend, max_spend, is_locked, org_id, created_at FROM budget_categories WHERE org_id = ? ORDER BY id ASC",
        (target_id,)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["is_locked"] = bool(d["is_locked"])
        d["category_name"] = d["name"]
        result.append(d)
    return result


def create_category(name: str, current_budget: float, min_spend: float, max_spend: float, is_locked: bool = False, org_id: str = DEFAULT_ORG_ID) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    target_id = _normalize_org_id(org_id)
    cursor.execute(
        """INSERT INTO budget_categories (name, current_budget, min_spend, max_spend, is_locked, org_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (name, current_budget, min_spend, max_spend, 1 if is_locked else 0, target_id, datetime.utcnow().isoformat())
    )
    cat_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {
        "id": cat_id,
        "name": name,
        "category_name": name,
        "current_budget": current_budget,
        "min_spend": min_spend,
        "max_spend": max_spend,
        "is_locked": is_locked,
        "org_id": target_id,
    }


def update_category(cat_id: int, **fields) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    allowed = ["name", "current_budget", "min_spend", "max_spend", "is_locked"]
    updates = []
    params = []
    for k, v in fields.items():
        if k in allowed:
            if k == "is_locked":
                v = 1 if v else 0
            updates.append(f"{k} = ?")
            params.append(v)
    if not updates:
        conn.close()
        return None
    params.append(cat_id)
    conn.execute(f"UPDATE budget_categories SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    row = conn.execute("SELECT * FROM budget_categories WHERE id = ?", (cat_id,)).fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["is_locked"] = bool(d["is_locked"])
        d["category_name"] = d["name"]
        return d
    return None


def save_categories(categories: List[Dict[str, Any]], org_id: str = DEFAULT_ORG_ID) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()

    for c in categories:
        cat_id = c.get("id")
        name = str(c.get("name") or c.get("category_name", "")).strip()
        current_budget = float(c.get("current_budget", 0))
        min_spend = float(c.get("min_spend", 0))
        max_spend = float(c.get("max_spend", max(100000.0, current_budget * 2.0)))
        is_locked = 1 if c.get("is_locked") else 0

        existing = None
        if cat_id and str(cat_id).isdigit():
            existing = cursor.execute("SELECT id FROM budget_categories WHERE id = ? AND org_id = ?", (int(cat_id), target_id)).fetchone()
        if not existing and name:
            existing = cursor.execute("SELECT id FROM budget_categories WHERE name = ? AND org_id = ?", (name, target_id)).fetchone()

        if existing:
            cursor.execute(
                """UPDATE budget_categories
                   SET name = ?, current_budget = ?, min_spend = ?, max_spend = ?, is_locked = ?
                   WHERE id = ?""",
                (name, current_budget, min_spend, max_spend, is_locked, existing["id"])
            )
            cursor.execute(
                """UPDATE budget_recommendations
                   SET current_budget = ?
                   WHERE org_id = ? AND (category_id = ? OR category_name = ?)""",
                (current_budget, target_id, existing["id"], name)
            )
        else:
            cursor.execute(
                """INSERT INTO budget_categories (org_id, name, current_budget, min_spend, max_spend, is_locked, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (target_id, name, current_budget, min_spend, max_spend, is_locked, now)
            )

    conn.commit()
    conn.close()
    return get_categories(target_id)


def apply_budget_allocations(allocations: Dict[str, float], org_id: str = DEFAULT_ORG_ID) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    cursor = conn.cursor()

    for name_or_id, amount in allocations.items():
        val = float(amount)
        if str(name_or_id).isdigit():
            cursor.execute("UPDATE budget_categories SET current_budget = ? WHERE id = ? AND org_id = ?", (val, int(name_or_id), target_id))
            cursor.execute("UPDATE budget_recommendations SET current_budget = ?, recommended_budget = ? WHERE category_id = ? AND org_id = ?", (val, val, int(name_or_id), target_id))
        else:
            cursor.execute("UPDATE budget_categories SET current_budget = ? WHERE name = ? AND org_id = ?", (val, str(name_or_id), target_id))
            cursor.execute("UPDATE budget_recommendations SET current_budget = ?, recommended_budget = ? WHERE category_name = ? AND org_id = ?", (val, val, str(name_or_id), target_id))

    conn.commit()
    conn.close()
    return get_categories(target_id)


def get_historical_spend(org_id: str = DEFAULT_ORG_ID, category_id: Optional[int] = None, period: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    query = """
        SELECT hs.id, hs.category_id, bc.name as category_name, hs.org_id, hs.period, hs.amount, hs.actual_roi, hs.created_at
        FROM historical_spend hs
        JOIN budget_categories bc ON hs.category_id = bc.id
        WHERE hs.org_id = ?
    """
    params: list = [target_id]
    if category_id:
        query += " AND hs.category_id = ?"
        params.append(category_id)
    if period:
        query += " AND hs.period = ?"
        params.append(period)
    query += " ORDER BY hs.period ASC, bc.id ASC"

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_priorities(org_id: str = DEFAULT_ORG_ID, period: str = "Q4 2026") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    rows = conn.execute(
        "SELECT id, priority_name, weight, description, period FROM business_priorities WHERE org_id = ? AND period = ? ORDER BY weight DESC, id ASC",
        (target_id, period)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_priorities(priorities: List[Dict[str, Any]], org_id: str = DEFAULT_ORG_ID, period: str = "Q4 2026") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    conn.execute("DELETE FROM business_priorities WHERE org_id = ? AND period = ?", (target_id, period))
    now = datetime.utcnow().isoformat()
    for p in priorities:
        conn.execute(
            """INSERT INTO business_priorities (priority_name, weight, description, org_id, period, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (p["priority_name"], float(p["weight"]), p.get("description", ""), target_id, period, now)
        )
    conn.commit()
    conn.close()
    return get_priorities(target_id, period)


def get_recommendations(org_id: str = DEFAULT_ORG_ID, period: Optional[str] = None, scenario_type: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    effective_scenario = scenario_type or "balanced"
    query = "SELECT * FROM budget_recommendations WHERE org_id = ?"
    params: list = [target_id]
    if period:
        query += " AND period = ?"
        params.append(period)
    query += " AND scenario_type = ?"
    params.append(effective_scenario)
    query += " ORDER BY id ASC"

    rows = conn.execute(query, params).fetchall()
    if not rows and not scenario_type:
        # Fall back to any scenario recommendations if 'balanced' is missing
        rows = conn.execute("SELECT * FROM budget_recommendations WHERE org_id = ? ORDER BY id ASC", (target_id,)).fetchall()
        seen = set()
        deduped = []
        for r in rows:
            d = dict(r)
            cname = d.get("category_name") or d.get("category")
            if cname not in seen:
                seen.add(cname)
                deduped.append(d)
        conn.close()
        return deduped

    conn.close()
    return [dict(r) for r in rows]


def save_recommendations(recs: List[Dict[str, Any]], org_id: str = DEFAULT_ORG_ID, period: str = "Q4 2026", scenario_type: str = "balanced"):
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    now = datetime.utcnow().isoformat()
    conn.execute("DELETE FROM budget_recommendations WHERE org_id = ? AND period = ? AND scenario_type = ?", (target_id, period, scenario_type))
    for r in recs:
        conn.execute(
            """INSERT INTO budget_recommendations (org_id, period, category_id, category_name, current_budget, recommended_budget, projected_impact, confidence, scenario_type, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                target_id,
                period,
                r.get("category_id"),
                r.get("category_name", r.get("category", "")),
                float(r.get("current_budget", 0)),
                float(r.get("recommended_budget", 0)),
                str(r.get("projected_impact", "Optimized")),
                float(r.get("confidence", 0.90)),
                scenario_type,
                now,
            )
        )
    conn.commit()
    conn.close()


def get_alerts(org_id: str = DEFAULT_ORG_ID, limit: int = 50, acknowledged: Optional[bool] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    query = "SELECT * FROM risk_alerts WHERE org_id = ?"
    params: list = [target_id]
    if acknowledged is not None:
        query += " AND acknowledged = ?"
        params.append(1 if acknowledged else 0)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["acknowledged"] = bool(d["acknowledged"])
        result.append(d)
    return result


def acknowledge_alert(alert_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE risk_alerts SET acknowledged = 1 WHERE id = ?", (alert_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def get_alert_narrative(alert_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM alert_narratives WHERE alert_id = ?", (alert_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["suggested_action"] = {
        "type": d.get("action_category", "reallocate"),
        "from_category": "Marketing",
        "to_category": "Reserve Cushion",
        "amount": d.get("estimated_cost", 15000.0),
    }
    d["confidence"] = "high"
    return d


def get_latest_indicators(org_id: str = DEFAULT_ORG_ID, period: Optional[str] = "Q4 2026") -> Dict[str, List[Dict[str, Any]]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    query = """
        SELECT indicator_type, category, value, period, source, created_at
        FROM risk_indicators
        WHERE org_id = ?
        ORDER BY CASE WHEN period = ? THEN 1 ELSE 0 END DESC, rowid DESC
    """
    rows = conn.execute(query, (target_id, period or "Q4 2026")).fetchall()
    conn.close()

    result: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        t = r["indicator_type"]
        if t not in result:
            result[t] = []
        result[t].append(dict(r))
    return result


def add_indicators(indicators: List[Dict[str, Any]], org_id: str = DEFAULT_ORG_ID) -> int:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    now = datetime.utcnow().isoformat()
    rows = [
        (
            target_id,
            i["indicator_type"],
            i.get("category", "General"),
            float(i["value"]),
            i.get("period", "Q4 2026"),
            i.get("source", "Manual Ingestion"),
            now
        )
        for i in indicators
    ]
    cursor = conn.cursor()
    cursor.executemany(
        """INSERT INTO risk_indicators (org_id, indicator_type, category, value, period, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        rows
    )
    count = cursor.rowcount
    conn.commit()
    conn.close()
    return count


def get_latest_risk_score(org_id: str = DEFAULT_ORG_ID) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    row = conn.execute(
        "SELECT * FROM risk_scores WHERE org_id = ? ORDER BY created_at DESC LIMIT 1",
        (target_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    try:
        d["breakdown_json"] = json.loads(d["breakdown_json"])
    except Exception:
        pass
    return d


def save_risk_score(
    org_id: str,
    period: str,
    composite_score: float,
    breakdown_json: Any,
    severity: str,
) -> Dict[str, Any]:
    conn = get_db_connection()
    target_id = _normalize_org_id(org_id)
    now = datetime.utcnow().isoformat()
    raw_bd = json.dumps(breakdown_json) if not isinstance(breakdown_json, str) else breakdown_json
    conn.execute(
        """INSERT INTO risk_scores (org_id, period, composite_score, breakdown_json, severity, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (target_id, period, float(composite_score), raw_bd, severity, now)
    )
    conn.commit()
    conn.close()
    return {
        "org_id": target_id,
        "period": period,
        "composite_score": composite_score,
        "breakdown_json": breakdown_json,
        "severity": severity,
        "created_at": now,
    }
