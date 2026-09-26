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
    """
    Streamlined, honest ML training pipeline:
    Historical spending -> Clean data -> Create previous-month features (no leakage)
    -> Train XGBoost -> Test on future data -> MAE / RMSE / R² -> Save model -> Forecast.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, 'data', 'processed_features.csv')
    
    if not os.path.exists(data_path):
        from preprocessing.feature_engineering import process_data
        raw_path = os.path.join(base_dir, 'data', 'financial_data.csv')
        process_data(raw_path, data_path)

    df = pd.read_csv(data_path)
    df['period_dt'] = pd.to_datetime(df['period'] + '-01')
    df = df.sort_values(by='period_dt').reset_index(drop=True)
    
    features = [
        'month', 'quarter', 'month_sin', 'month_cos',
        'category_encoded', 'amount_lag_1', 'amount_lag_2', 'amount_lag_3',
        'rolling_3m_avg', 'rolling_6m_avg', 'roi_lag_1', 'mom_growth', 'spend_ratio'
    ]
    # Filter only available columns
    features = [f for f in features if f in df.columns]
    target = 'amount'
    
    # Sequential 80/20 temporal train/test split (testing strictly on future periods)
    unique_periods = sorted(df['period'].unique())
    split_idx = max(1, int(len(unique_periods) * 0.8))
    split_period = unique_periods[split_idx]
    
    train_df = df[df['period'] < split_period]
    test_df = df[df['period'] >= split_period]
    
    if len(train_df) == 0 or len(test_df) == 0:
        # Fallback to simple index split if periods are too few
        split_point = int(len(df) * 0.8)
        train_df = df.iloc[:split_point]
        test_df = df.iloc[split_point:]
    
    X_train, y_train = train_df[features], train_df[target]
    X_test, y_test = test_df[features], test_df[target]
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train XGBoost regressor for monthly spending forecasting
    model = XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42
    )
    model.fit(X_train_scaled, y_train)
    preds = model.predict(X_test_scaled)
    
    mae = float(mean_absolute_error(y_test, preds))
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
    r2 = float(r2_score(y_test, preds))
    mape = float(np.mean(np.abs((y_test - preds) / np.maximum(y_test, 1.0))) * 100.0)
    
    best_metrics = {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "mape": round(mape, 2)
    }
    
    print("XGBoost Spending Forecaster Training Results:")
    print(f"  Training Samples: {len(X_train)} | Test Samples: {len(X_test)}")
    print(f"  Test MAE:   ₹{mae:,.2f}")
    print(f"  Test RMSE:  ₹{rmse:,.2f}")
    print(f"  Test R²:    {r2:.4f}")
    print(f"  Test MAPE:  {mape:.2f}%")
    
    os.makedirs(os.path.join(base_dir, 'models'), exist_ok=True)
    model_path = os.path.join(base_dir, 'models', 'spend_forecast_model.pkl')
    scaler_path = os.path.join(base_dir, 'models', 'scaler.pkl')
    meta_path = os.path.join(base_dir, 'models', 'model_metadata.json')
    
    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)
    
    metadata = {
        "model_name": "spend_forecaster",
        "version": "v2.4.1",
        "algorithm": "XGBoost Regression",
        "features": features,
        "metrics": best_metrics,
        "description": "We use XGBoost regression for spending forecasting, trained strictly on historical lag features without data leakage.",
        "trained_at": datetime.datetime.utcnow().isoformat()
    }
    
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print("✓ Saved XGBoost model, scaler, and metadata to ml_training/models/")
    return best_metrics

if __name__ == "__main__":
    train()
