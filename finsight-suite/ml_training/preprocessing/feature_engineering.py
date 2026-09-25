import os
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

def process_data(input_path, output_path):
    print(f"Loading data from {input_path}")
    if not os.path.exists(input_path):
        print(f"File {input_path} not found. Please run seed.py first.")
        return
        
    df = pd.read_csv(input_path)
    print("Initial shape:", df.shape)
    
    # Expected columns: category, period (YYYY-MM), amount, actual_roi
    df['period_dt'] = pd.to_datetime(df['period'] + '-01')
    df = df.sort_values(by=['category', 'period_dt']).reset_index(drop=True)
    
    df['month'] = df['period_dt'].dt.month
    df['quarter'] = df['period_dt'].dt.quarter
    
    # Lags and rolling
    df['amount_lag_1'] = df.groupby('category')['amount'].shift(1)
    df['amount_lag_3'] = df.groupby('category')['amount'].shift(3)
    df['rolling_3m_avg'] = df.groupby('category')['amount'].transform(lambda x: x.rolling(3, min_periods=1).mean())
    df['rolling_6m_avg'] = df.groupby('category')['amount'].transform(lambda x: x.rolling(6, min_periods=1).mean())
    df['roi_lag_1'] = df.groupby('category')['actual_roi'].shift(1)
    
    # Spend ratio
    monthly_totals = df.groupby('period_dt')['amount'].transform('sum')
    df['spend_ratio'] = df['amount'] / monthly_totals
    
    # MoM growth
    df['mom_growth'] = df.groupby('category')['amount'].pct_change() * 100
    
    # Year-over-Year growth (if sufficient history, else filled with 0)
    df['yoy_growth'] = df.groupby('category')['amount'].pct_change(12) * 100

    # Month-of-year cyclical seasonality features
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12.0)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12.0)
    
    # Label encoding
    le = LabelEncoder()
    df['category_encoded'] = le.fit_transform(df['category'])
    
    # Fill NAs
    df = df.fillna(0)
    df = df.drop(columns=['period_dt'])
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Saved processed features to {output_path}")
    print("Processed shape:", df.shape)

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    in_path = os.path.join(base_dir, 'data', 'financial_data.csv')
    out_path = os.path.join(base_dir, 'data', 'processed_features.csv')
    process_data(in_path, out_path)
