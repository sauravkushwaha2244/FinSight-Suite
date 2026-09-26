import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

def process_data(input_path: str, output_path: str) -> pd.DataFrame:
    """
    Cleans financial spending data and creates leakage-free time-series features.
    
    IMPORTANT - NO DATA LEAKAGE:
    To predict spending in month T (target = amount_T), all features must be computed
    STRICTLY using historical data prior to month T (T-1, T-2, T-3, ...).
    Month T's actual spending is NEVER included in rolling averages, momentum, or ratios.
    """
    print(f"Loading data from {input_path}")
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"File {input_path} not found.")

    df = pd.read_csv(input_path)
    print("Initial shape:", df.shape)

    # Normalize column names if needed
    col_map = {}
    for c in df.columns:
        cl = c.strip().lower()
        if cl in ("date", "period"):
            col_map[c] = "period"
        elif cl in ("category", "category_name", "department"):
            col_map[c] = "category"
        elif cl in ("amount", "spend", "spending"):
            col_map[c] = "amount"
        elif cl in ("roi", "actual_roi", "base_roi"):
            col_map[c] = "actual_roi"
    df = df.rename(columns=col_map)

    if "actual_roi" not in df.columns:
        df["actual_roi"] = 1.2

    # Parse period and sort strictly chronologically by category and time
    df["period_dt"] = pd.to_datetime(df["period"] + "-01")
    df = df.sort_values(by=["category", "period_dt"]).reset_index(drop=True)

    # Calendar features for target prediction month T
    df["month"] = df["period_dt"].dt.month
    df["quarter"] = df["period_dt"].dt.quarter
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12.0)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12.0)

    # Strict historical lag features (prior months only)
    df["amount_lag_1"] = df.groupby("category")["amount"].shift(1)
    df["amount_lag_2"] = df.groupby("category")["amount"].shift(2)
    df["amount_lag_3"] = df.groupby("category")["amount"].shift(3)

    # Strict historical rolling averages: shift(1) ensures current month T is excluded!
    df["rolling_3m_avg"] = df.groupby("category")["amount"].transform(
        lambda s: s.shift(1).rolling(3, min_periods=1).mean()
    )
    df["rolling_6m_avg"] = df.groupby("category")["amount"].transform(
        lambda s: s.shift(1).rolling(6, min_periods=1).mean()
    )

    # Historical ROI lag
    df["roi_lag_1"] = df.groupby("category")["actual_roi"].shift(1)

    # Historical MoM growth rate entering month T (prior month T-1 vs month T-2)
    prev_growth = (df["amount_lag_1"] - df["amount_lag_2"]) / df["amount_lag_2"].replace(0, np.nan) * 100.0
    df["mom_growth"] = prev_growth.fillna(0.0)

    # Historical spend ratio entering month T (lag_1 spend / total lag_1 spend)
    prev_monthly_totals = df.groupby("period_dt")["amount_lag_1"].transform("sum")
    df["spend_ratio"] = (df["amount_lag_1"] / prev_monthly_totals.replace(0, np.nan)).fillna(0.0)

    # Category label encoding
    le = LabelEncoder()
    df["category_encoded"] = le.fit_transform(df["category"].astype(str))

    # Drop warmup rows where lag_3 is not yet available, ensuring full feature richness
    # and preventing artificial 0-padding from contaminating model training
    df_clean = df.dropna(subset=["amount_lag_3"]).copy()
    df_clean = df_clean.fillna(0)
    df_clean = df_clean.drop(columns=["period_dt"])

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_clean.to_csv(output_path, index=False)
    print(f"Saved processed leakage-free features to {output_path}")
    print("Processed shape:", df_clean.shape)
    return df_clean

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    in_path = os.path.join(base_dir, "data", "financial_data.csv")
    out_path = os.path.join(base_dir, "data", "processed_features.csv")
    process_data(in_path, out_path)
