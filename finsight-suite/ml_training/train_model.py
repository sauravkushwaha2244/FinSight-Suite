import os
import json
import joblib
import datetime
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

def train():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, 'data', 'processed_features.csv')
    
    if not os.path.exists(data_path):
        print(f"Data file not found at {data_path}. Run feature_engineering.py first.")
        return

    df = pd.read_csv(data_path)
    df['period_dt'] = pd.to_datetime(df['period'] + '-01')
    df = df.sort_values(by='period_dt').reset_index(drop=True)
    
    base_features = [
        'month', 'quarter', 'amount_lag_1', 'amount_lag_3',
        'rolling_3m_avg', 'rolling_6m_avg', 'roi_lag_1',
        'spend_ratio', 'mom_growth', 'category_encoded'
    ]
    additional_features = ['yoy_growth', 'month_sin', 'month_cos']
    features = [f for f in base_features + additional_features if f in df.columns]
    target = 'amount'
    
    # 80/20 train/test split sequentially
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]
    
    X_train, y_train = train_df[features], train_df[target]
    X_test, y_test = test_df[features], test_df[target]
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train XGBoost model
    model = XGBRegressor(n_estimators=100, random_state=42)
    model.fit(X_train_scaled, y_train)
    preds = model.predict(X_test_scaled)
    
    mae = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    r2 = r2_score(y_test, preds)
    
    best_model_name = 'XGBoost'
    best_model = model
    best_metrics = {"mae": mae, "rmse": rmse, "r2": r2}
    
    print("XGBoost Training Results:")
    print(f"  MAE:  {mae:.2f}")
    print(f"  RMSE: {rmse:.2f}")
    print(f"  R^2:  {r2:.4f}")
    
    os.makedirs(os.path.join(base_dir, 'models'), exist_ok=True)
    model_path = os.path.join(base_dir, 'models', 'spend_forecast_model.pkl')
    scaler_path = os.path.join(base_dir, 'models', 'scaler.pkl')
    meta_path = os.path.join(base_dir, 'models', 'model_metadata.json')
    
    joblib.dump(best_model, model_path)
    joblib.dump(scaler, scaler_path)
    
    metadata = {
        "model_name": "spend_forecaster",
        "version": "1.0.0",
        "algorithm": best_model_name,
        "features": features,
        "metrics": best_metrics,
        "trained_at": datetime.datetime.utcnow().isoformat()
    }
    
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print("Saved best model, scaler, and metadata to models/")

if __name__ == "__main__":
    train()
