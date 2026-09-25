import sqlite3
import os
import hashlib
import secrets
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "finsight.db")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
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


def init_db():
    """Initializes tables and seeds initial data if database is new."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        org_id TEXT NOT NULL DEFAULT 'org-default',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL DEFAULT 'org-default',
        name TEXT NOT NULL,
        current_budget REAL NOT NULL DEFAULT 0,
        min_spend REAL NOT NULL DEFAULT 0,
        max_spend REAL NOT NULL DEFAULT 0,
        is_locked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS business_priorities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL DEFAULT 'org-default',
        period TEXT NOT NULL DEFAULT 'Q4 2026',
        priority_name TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 0,
        description TEXT DEFAULT '',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_indicators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id TEXT NOT NULL DEFAULT 'org-default',
        indicator_type TEXT NOT NULL,
        value REAL NOT NULL,
        period TEXT NOT NULL DEFAULT 'Q4 2026',
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_alerts (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'org-default',
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
    """)

    # Check if admin user exists; if not, seed default admin
    cursor.execute("SELECT id FROM users WHERE email = ?", ("admin@finsight.com",))
    if not cursor.fetchone():
        pwd_hash, salt = hash_password("admin123")
        cursor.execute(
            """INSERT INTO users (id, email, password_hash, salt, full_name, role, org_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            ("usr-admin-1", "admin@finsight.com", pwd_hash, salt, "FinSight Administrator", "admin", "org-default", datetime.utcnow().isoformat())
        )
        logger.info("✓ Seeded default admin account: admin@finsight.com / admin123")

    # Check if categories exist; if not, seed realistic live budget categories
    cursor.execute("SELECT COUNT(*) as count FROM budget_categories")
    if cursor.fetchone()["count"] == 0:
        default_categories = [
            ("Marketing & Advertising", 200000.0, 100000.0, 500000.0, 0),
            ("Research & Development", 300000.0, 200000.0, 600000.0, 0),
            ("Operations & Infrastructure", 500000.0, 300000.0, 800000.0, 1),
            ("Sales & Distribution", 180000.0, 80000.0, 400000.0, 0),
            ("HR & Administration", 120000.0, 50000.0, 250000.0, 0),
        ]
        now = datetime.utcnow().isoformat()
        cursor.executemany(
            """INSERT INTO budget_categories (name, current_budget, min_spend, max_spend, is_locked, org_id, created_at)
               VALUES (?, ?, ?, ?, ?, 'org-default', ?)""",
            [(c[0], c[1], c[2], c[3], c[4], now) for c in default_categories]
        )
        logger.info("✓ Seeded default budget categories into database")

    # Check if business priorities exist; if not, seed
    cursor.execute("SELECT COUNT(*) as count FROM business_priorities")
    if cursor.fetchone()["count"] == 0:
        default_priorities = [
            ("Growth", 40.0, "Revenue expansion and market penetration"),
            ("Profitability", 30.0, "Margin optimization and unit economics"),
            ("Innovation", 20.0, "New capabilities and AI-driven workflows"),
            ("Stability", 10.0, "Cash reserves and risk containment"),
        ]
        now = datetime.utcnow().isoformat()
        cursor.executemany(
            """INSERT INTO business_priorities (priority_name, weight, description, org_id, period, created_at)
               VALUES (?, ?, ?, 'org-default', 'Q4 2026', ?)""",
            [(p[0], p[1], p[2], now) for p in default_priorities]
        )
        logger.info("✓ Seeded default business priorities into database")

    # Check if risk indicators exist; if not, seed
    cursor.execute("SELECT COUNT(*) as count FROM risk_indicators")
    if cursor.fetchone()["count"] == 0:
        indicators = [
            ("liquidity", 34.0),
            ("budget_variance", 55.0),
            ("vendor_concentration", 81.0),
            ("forecast_deviation", 38.0),
            ("volatility", 72.0),
        ]
        now = datetime.utcnow().isoformat()
        cursor.executemany(
            """INSERT INTO risk_indicators (indicator_type, value, org_id, period, created_at)
               VALUES (?, ?, 'org-default', 'Q4 2026', ?)""",
            [(i[0], i[1], now) for i in indicators]
        )

    # Check if risk alerts exist; if not, seed
    cursor.execute("SELECT COUNT(*) as count FROM risk_alerts")
    if cursor.fetchone()["count"] == 0:
        now = datetime.utcnow()
        default_alerts = [
            (
                "alert-001",
                "org-default",
                "critical",
                "Vendor Concentration",
                "Vendor concentration risk exceeds 80% threshold — top 3 suppliers represent critical exposure. Diversification recommended.",
                "Vendor score 81.0 exceeds threshold 80",
                "Q4 2026",
                0,
                (now - timedelta(minutes=25)).isoformat()
            ),
            (
                "alert-002",
                "org-default",
                "high",
                "Liquidity",
                "Liquidity ratio approaching minimum acceptable threshold. Review payables schedule and cash reserves.",
                "Liquidity score 34.0 below minimum safe buffer",
                "Q4 2026",
                0,
                (now - timedelta(hours=1)).isoformat()
            ),
            (
                "alert-003",
                "org-default",
                "high",
                "Volatility",
                "Expense volatility elevated in Operations & Infrastructure. Run scenario stress test.",
                "Volatility index 72.0 indicates unexpected variance",
                "Q4 2026",
                0,
                (now - timedelta(hours=3)).isoformat()
            ),
            (
                "alert-004",
                "org-default",
                "medium",
                "Budget Variance",
                "Marketing spend trending 15% above forecast for mid-period. Early intervention advised.",
                "Budget variance 55.0 points to tracking risk",
                "Q4 2026",
                0,
                (now - timedelta(hours=6)).isoformat()
            ),
            (
                "alert-005",
                "org-default",
                "low",
                "Forecast Deviation",
                "Forecast deviation within acceptable limits (+/- 5%). No immediate action required.",
                "Forecast deviation 38.0 within safe zone",
                "Q4 2026",
                1,
                (now - timedelta(days=1)).isoformat()
            ),
        ]
        cursor.executemany(
            """INSERT INTO risk_alerts (id, org_id, severity, indicator_type, message, threshold_breached, period, acknowledged, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            default_alerts
        )
        logger.info("✓ Seeded default risk alerts into database")

    conn.commit()
    conn.close()


# ── User Helpers ─────────────────────────────────────────────────────────────

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


def create_user(email: str, password: str, full_name: str, role: str = "admin", org_id: str = "org-default") -> Dict[str, Any]:
    email_clean = email.lower().strip()
    existing = get_user_by_email(email_clean)
    if existing:
        raise ValueError("User with this email already exists")

    pwd_hash, salt = hash_password(password)
    user_id = f"usr-{secrets.token_hex(6)}"
    created_at = datetime.utcnow().isoformat()

    conn = get_db_connection()
    conn.execute(
        """INSERT INTO users (id, email, password_hash, salt, full_name, role, org_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (user_id, email_clean, pwd_hash, salt, full_name.strip(), role, org_id, created_at)
    )
    conn.commit()
    conn.close()

    return {
        "id": user_id,
        "email": email_clean,
        "full_name": full_name.strip(),
        "role": role,
        "org_id": org_id,
        "created_at": created_at
    }


# ── Budget Helpers ───────────────────────────────────────────────────────────

def get_categories(org_id: str = "org-default") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, name, current_budget, min_spend, max_spend, is_locked, org_id, created_at FROM budget_categories WHERE org_id = ? ORDER BY id ASC",
        (org_id,)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["is_locked"] = bool(d["is_locked"])
        d["category_name"] = d["name"]
        result.append(d)
    return result


def create_category(name: str, current_budget: float, min_spend: float, max_spend: float, is_locked: bool = False, org_id: str = "org-default") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO budget_categories (name, current_budget, min_spend, max_spend, is_locked, org_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (name, current_budget, min_spend, max_spend, 1 if is_locked else 0, org_id, datetime.utcnow().isoformat())
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
        "org_id": org_id,
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


def get_priorities(org_id: str = "org-default", period: str = "Q4 2026") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, priority_name, weight, description, period FROM business_priorities WHERE org_id = ? AND period = ? ORDER BY id ASC",
        (org_id, period)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_priorities(priorities: List[Dict[str, Any]], org_id: str = "org-default", period: str = "Q4 2026") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    conn.execute("DELETE FROM business_priorities WHERE org_id = ? AND period = ?", (org_id, period))
    now = datetime.utcnow().isoformat()
    for p in priorities:
        conn.execute(
            """INSERT INTO business_priorities (priority_name, weight, description, org_id, period, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (p["priority_name"], float(p["weight"]), p.get("description", ""), org_id, period, now)
        )
    conn.commit()
    conn.close()
    return get_priorities(org_id, period)


# ── Risk Helpers ─────────────────────────────────────────────────────────────

def get_alerts(org_id: str = "org-default", limit: int = 50, acknowledged: Optional[bool] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    query = "SELECT * FROM risk_alerts WHERE org_id = ?"
    params = [org_id]
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


def get_latest_indicators(org_id: str = "org-default") -> Dict[str, List[Dict[str, Any]]]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT indicator_type, value, created_at FROM risk_indicators WHERE org_id = ? ORDER BY created_at DESC",
        (org_id,)
    ).fetchall()
    conn.close()

    result: Dict[str, List[Dict[str, Any]]] = {}
    for r in rows:
        t = r["indicator_type"]
        if t not in result:
            result[t] = []
        result[t].append({"indicator_type": t, "value": r["value"], "created_at": r["created_at"]})
    return result
