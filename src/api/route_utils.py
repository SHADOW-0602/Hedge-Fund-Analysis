import pandas as pd
import polars as pl
import numpy as np
import math

def normalize_portfolio_format(df):
    """Normalize portfolio data format"""
    if isinstance(df, pd.DataFrame):
        df_pl = pl.from_pandas(df)
    else:
        df_pl = df
    
    df_pl = df_pl.rename({col: col.lower().strip() for col in df_pl.columns})
    cols = df_pl.columns
    
    if 'symbol' in cols and 'quantity' in cols and 'price' in cols:
        df_pl = df_pl.select([
            pl.col('symbol'),
            pl.col('quantity').cast(pl.Float64),
            pl.col('price').alias('avg_cost').cast(pl.Float64)
        ])
    elif 'ticker' in cols:
        df_pl = df_pl.with_columns([pl.col('ticker').alias('symbol')])
        if 'shares' in cols:
            df_pl = df_pl.with_columns([pl.col('shares').alias('quantity').cast(pl.Float64)])
        if 'cost_basis' in cols:
            df_pl = df_pl.with_columns([pl.col('cost_basis').alias('avg_cost').cast(pl.Float64)])
        elif 'price' in cols:
            df_pl = df_pl.with_columns([pl.col('price').alias('avg_cost').cast(pl.Float64)])
    
    if 'symbol' not in df_pl.columns:
        df_pl = df_pl.with_columns([pl.col(df_pl.columns[0]).alias('symbol')])
    if 'quantity' not in df_pl.columns:
        df_pl = df_pl.with_columns([pl.lit(100.0).alias('quantity')])
    if 'avg_cost' not in df_pl.columns:
        df_pl = df_pl.with_columns([pl.lit(100.0).alias('avg_cost')])
    
    result = df_pl.select(['symbol', 'quantity', 'avg_cost']).to_pandas()
    return result

def sanitize_for_json(obj):
    """Recursively sanitize data to ensure JSON serialization compatibility"""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(sanitize_for_json(v) for v in obj)
    elif isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    elif isinstance(obj, (np.integer, np.floating)):
        try:
            val = float(obj)
            if math.isnan(val) or math.isinf(val):
                return 0.0
            return val
        except (ValueError, OverflowError):
            return 0.0
    elif isinstance(obj, (int, float)):
        try:
            if math.isnan(obj) or math.isinf(obj) or obj == float('inf') or obj == float('-inf'):
                return 0.0
            return float(obj)
        except (ValueError, OverflowError, TypeError):
            return 0.0
    elif obj is None:
        return None
    elif isinstance(obj, str) and obj.lower() in ['inf', '-inf', 'infinity', '-infinity', 'nan']:
        return 0.0
    elif hasattr(obj, 'item'):  # numpy scalars
        try:
            val = float(obj.item())
            if math.isnan(val) or math.isinf(val):
                return 0.0
            return val
        except (ValueError, OverflowError):
            return 0.0
    else:
        return obj

def extract_valid_symbols(portfolio_data):
    """Extract valid symbols from portfolio data"""
    symbols = []
    for position in portfolio_data:
        try:
            if isinstance(position, dict) and 'symbol' in position:
                symbol = str(position['symbol']).strip().upper()
                if symbol and len(symbol) <= 10 and not symbol.startswith(('CUR:', 'CASH')):
                    symbols.append(symbol)
        except (ValueError, TypeError):
            continue
    return symbols

def calculate_portfolio_weights(portfolio_data):
    """Calculate normalized portfolio weights"""
    weights = {}
    total_value = 0
    
    for position in portfolio_data:
        try:
            symbol = str(position.get('symbol', '')).strip().upper()
            if symbol and not symbol.startswith(('CUR:', 'CASH')):
                quantity = float(position.get('quantity', 0))
                price = float(position.get('avg_cost', 0))
                value = quantity * price
                weights[symbol] = value
                total_value += value
        except (ValueError, TypeError):
            continue
    
    # Normalize weights
    if total_value > 0:
        weights = {k: v/total_value for k, v in weights.items()}
    
    return weights, total_value