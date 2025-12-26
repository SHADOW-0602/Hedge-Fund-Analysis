import pandas as pd
import polars as pl
import numpy as np
import math
import re

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
    """Extract valid symbols from portfolio data, including underlying symbols from options"""
    symbols = set()
    
    def extract_underlying_symbol(options_symbol):
        """Extract underlying symbol from options contract"""
        try:
            import re
            match = re.search(r'(\w+)(\d{6})[CP]\d+', options_symbol)
            if match:
                return match.group(1)
        except:
            pass
        return None
    
    for position in portfolio_data:
        try:
            if isinstance(position, dict):
                # Handle symbol keys
                symbol_keys = ['symbol', 'Symbol', 'ticker', 'Ticker', 'instrument']
                symbol = ''
                for k in symbol_keys:
                    if k in position:
                        symbol = str(position[k]).strip().upper()
                        break
                
                if not symbol:
                    continue
                
                # Handle options contracts - extract underlying symbol
                if any(x in symbol for x in ['C00', 'P00']):
                    underlying = extract_underlying_symbol(symbol)
                    if underlying and not underlying.startswith(('CUR:', 'CASH', 'USD')):
                        symbols.add(underlying)
                    continue
                
                # Skip various non-equity symbols
                skip_patterns = ['CUR:', 'CASH', 'USD', 'FX:', 'CRYPTO:', 'BOND:', 'FUND:', 'INDEX:', 'COMMODITY:', 'FUTURE:', 'WARRANT:']
                skip_symbols = ['ACHN', 'CASH', 'N/A', 'NULL', 'UNKNOWN']
                
                if (any(symbol.startswith(pattern) for pattern in skip_patterns) or 
                    symbol in skip_symbols or 
                    len(symbol) < 1 or len(symbol) > 20):
                    continue
                
                # Add regular stock symbols
                symbols.add(symbol)
                
        except (ValueError, TypeError):
            continue
    
    return list(symbols)

def calculate_portfolio_weights(portfolio_data):
    """Calculate normalized portfolio weights, handling options contracts"""
    weights = {}
    total_value = 0
    
    def extract_underlying_symbol(options_symbol):
        """Extract underlying symbol from options contract"""
        try:
            import re
            match = re.search(r'(\w+)(\d{6})[CP]\d+', options_symbol)
            if match:
                return match.group(1)
        except:
            pass
        return None
    
    # Group positions by underlying symbol
    underlying_positions = {}
    
    # Helper to get value from multiple possible keys
    def get_val(item, keys, default=None):
        for k in keys:
            if k in item:
                return item[k]
        return default

    for position in portfolio_data:
        try:
            # Handle symbol keys
            symbol_keys = ['symbol', 'Symbol', 'ticker', 'Ticker', 'instrument']
            symbol = str(get_val(position, symbol_keys, '')).strip().upper()
            
            if not symbol:
                continue
            
            # Handle quantity keys
            qty_keys = ['quantity', 'Quantity', 'qty', 'Qty', 'shares', 'Shares']
            qty_val = get_val(position, qty_keys, 0)
            quantity = float(qty_val)
            
            # Handle price keys
            # prioritizing 'price' over 'avg_cost' but both are acceptable fallback
            price_keys = ['price', 'Price', 'current_price', 'last_price', 'avg_cost', 'cost_basis']
            price_val = get_val(position, price_keys, 100.0)
            price = float(price_val)
            
            # Handle missing or zero prices
            if price <= 0:
                price = 100.0
            
            value = abs(quantity) * price
            
            # Handle options contracts - group by underlying
            if any(x in symbol for x in ['C00', 'P00']):
                underlying = extract_underlying_symbol(symbol)
                if underlying and not underlying.startswith(('CUR:', 'CASH', 'USD')):
                    if underlying not in underlying_positions:
                        underlying_positions[underlying] = 0
                    underlying_positions[underlying] += value
                continue
            
            # Skip various non-equity symbols
            skip_patterns = ['CUR:', 'CASH', 'USD', 'FX:', 'CRYPTO:', 'BOND:', 'FUND:', 'INDEX:', 'COMMODITY:', 'FUTURE:', 'WARRANT:']
            skip_symbols = ['ACHN', 'CASH', 'N/A', 'NULL', 'UNKNOWN']
            
            if (any(symbol.startswith(pattern) for pattern in skip_patterns) or 
                symbol in skip_symbols):
                continue
            
            # Add regular stock symbols
            if symbol not in underlying_positions:
                underlying_positions[symbol] = 0
            underlying_positions[symbol] += value
            
        except (ValueError, TypeError):
            continue
    
    # Calculate total value and weights
    total_value = sum(underlying_positions.values())
    
    if total_value > 0:
        weights = {k: v/total_value for k, v in underlying_positions.items()}
    elif underlying_positions:
        # Equal weights fallback
        equal_weight = 1.0 / len(underlying_positions)
        weights = {k: equal_weight for k in underlying_positions.keys()}
        total_value = sum(underlying_positions.values()) or 1000.0
    
    return weights, total_value