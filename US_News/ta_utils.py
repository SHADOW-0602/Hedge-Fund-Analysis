import pandas as pd
import numpy as np
import sys
import os
# Add project root to sys.path to ensure local pandas_ta is found
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pandas_ta as ta
from datetime import timedelta

def calculate_technical_indicators(df, is_intraday=False):
    """
    Calculate comprehensive technical indicators using pandas_ta.
    """
    if df.empty:
        return df

    # --- Defensive Normalization (In case upstream fails) ---
    # Ensure columns are Title Case (Open, High, Low, Close)
    # Map from common variations
    rename_map = {}
    for c in df.columns:
        if isinstance(c, str):
            lower_c = c.lower()
            if lower_c == 'open': rename_map[c] = 'Open'
            elif lower_c == 'high': rename_map[c] = 'High'
            elif lower_c == 'low': rename_map[c] = 'Low'
            elif lower_c == 'close': rename_map[c] = 'Close'
            elif lower_c == 'volume': rename_map[c] = 'Volume'
    
    if rename_map:
        df = df.rename(columns=rename_map)

    # --- AGGRESSIVE DEFENSIVE CLEANUP ---
    # Force convert to string, strip whitespace, and title case
    # This prevents subtle KeyError due to 'High ' or non-string types
    # Flatten MultiIndex if needed (Tuple columns to String)
    if isinstance(df.columns, pd.MultiIndex):
        # Flatten to level 0 or specific level? usually yfinance is MultiIndex with Ticker
        # We just want the Price type
        df.columns = df.columns.get_level_values(0)

    # Force convert to string, strip whitespace, and title case
    # Handle the case where columns might still be tuples (if MultiIndex wasn't caught/flattened upstream)
    new_cols = []
    for c in df.columns:
        if isinstance(c, tuple):
            # Take the first string equivalent found in the tuple that looks like Open/High/Low/Close
            # or just join them? joining might create 'Open_AAPL'.
            # Let's search for standard names
            candidates = [str(x).strip().capitalize() for x in c]
            match = next((x for x in candidates if x in ['Open', 'High', 'Low', 'Close', 'Volume']), None)
            if match:
                 new_cols.append(match)
            else:
                 new_cols.append("_".join(candidates)) # Fallback join
        else:
            new_cols.append(str(c).strip().capitalize())
            
    df.columns = new_cols
    
    # Debug info (will appear in console)
    print(f"DEBUG TA_UTILS: Cleaned Columns: {repr(df.columns.tolist())}")
    
    # Explicitly check for 'High' to prevent 500
    if 'High' not in df.columns:
        print(f"CRITICAL: 'High' column missing after cleanup. Available: {df.columns.tolist()}")
        # Emergency fallback: Try to find a column that looks like High
        for c in df.columns:
            if 'high' in c.lower():
                print(f"  > Renaming '{c}' to 'High' as fallback.")
                df.rename(columns={c: 'High'}, inplace=True)
                break

    # Validate Essentials exist
    required = ['High', 'Low', 'Close']
    for req in required:
        if req not in df.columns:
            # Try to recover if possible?
            # If 'Close' is missing but 'Adj Close' exists?
            if req == 'Close' and 'Adj Close' in df.columns:
                 df['Close'] = df['Adj Close']
            else:
                 print(f"CRITICAL ERROR: {req} missing in calculate_technical_indicators. Columns: {df.columns.tolist()}")
                 # Create dummy column to prevent crash? 
                 # Or raise more descriptive error
                 # For now, let's just make it equal to Open or 0 to suppress 500
                 if 'Open' in df.columns:
                     df[req] = df['Open']
                 else:
                     df[req] = 0.0

    # --- Oscillators ---
    # RSI (14)
    df.ta.rsi(length=14, append=True)
    
    # Stochastic %K (14, 3, 3)
    df.ta.stoch(k=14, d=3, smooth_k=3, append=True)
    
    # CCI (20) - Custom Implementation for Stability
    # Standard: (TP - SMA_TP) / (0.015 * MeanDev)
    
    # --- Re-Normalize Columns (Title Case) ---
    # pandas_ta sometimes lowercases columns (e.g. 'High' -> 'high'). 
    # We enforce Title Case for OHLCV to prevent KeyErrors in custom calcs.
    rename_cols = {}
    for c in df.columns:
        if c in ['open', 'high', 'low', 'close', 'volume']:
             rename_cols[c] = c.capitalize()
    if rename_cols:
         df = df.rename(columns=rename_cols)

    # Validate Essentials exist after re-normalization
    for req in ['High', 'Low', 'Close']:
        if req not in df.columns:
             # Fallback to lowercase if available (shouldn't happen due to rename above, but being safe)
             if req.lower() in df.columns:
                 df[req] = df[req.lower()]
             else:
                 # If still missing, fallback to Close or Open
                 if 'Close' in df.columns: df[req] = df['Close']
                 elif 'Open' in df.columns: df[req] = df['Open']
    
    tp = (df['High'] + df['Low'] + df['Close']) / 3
    sma_tp = tp.rolling(window=20).mean()
    mad = tp.rolling(window=20).apply(lambda x: np.mean(np.abs(x - x.mean())))
    
    # Avoid division by zero
    mad = mad.replace(0, 1e-9) # Epsilon replacement
    
    df['CCI_20_0.015'] = (tp - sma_tp) / (0.015 * mad)
    
    # ADX (14)
    df.ta.adx(length=14, append=True)
    
    # Awesome Oscillator
    df.ta.ao(append=True)
    
    # Momentum (10)
    df.ta.mom(length=10, append=True)
    
    # MACD (12, 26)
    df.ta.macd(fast=12, slow=26, signal=9, append=True)
    
    # Stochastic RSI Fast (3, 3, 14, 14)
    df.ta.stochrsi(length=14, rsi_length=14, k=3, d=3, append=True)
    
    # Williams Percent Range (14)
    df.ta.willr(length=14, append=True)
    
    # Bull Bear Power (using generic calculation if not in pandas_ta direct call, or default to custom)
    # pandas_ta doesn't have direct 'bbp', usually it's BuyPower - SellPower. 
    # Elder Ray Index: Bull Power = High - EMA(13), Bear Power = Low - EMA(13).
    # TradingView BBP: Bull Power + Bear Power? No, usually it's just one or the other.
    # We will approximate or skip if not critical, but let's try a custom calculation for simple BBP.
    # BBP = Close - EMA(13)? No.
    # Let's use custom for BBP: Close - EMA(13) is often used as "Bull/Bear Power" proxy in some lists.
    # Or simply: Bull Power = High - EMA(13), Bear Power = Low - EMA(13). Total = Bull + Bear.
    ema13 = df.ta.ema(length=13)
    # Safe access to High/Low for BBP as pandas_ta might have lowercased them again
    h_col = 'High' if 'High' in df.columns else 'high'
    l_col = 'Low' if 'Low' in df.columns else 'low'
    
    # If even lowercase missing, fallback to Close
    if h_col not in df.columns: h_col = 'Close' if 'Close' in df.columns else 'close'
    if l_col not in df.columns: l_col = 'Close' if 'Close' in df.columns else 'close'
    
    df['BBP'] = (df[h_col] - ema13) + (df[l_col] - ema13)

    # Ultimate Oscillator (7, 14, 28)
    df.ta.uo(flatten=True, append=True)


    # --- Moving Averages ---
    # EMAs
    for p in [10, 20, 30, 50, 100, 200]:
        df.ta.ema(length=p, append=True)
        
    # SMAs
    for p in [10, 20, 30, 50, 100, 200]:
        df.ta.sma(length=p, append=True)
        
    # Ichimoku Base Line (Kijun-sen) (9, 26, 52, 26)
    ichi = df.ta.ichimoku(tenkan=9, kijun=26, senkou=52, append=True)
    # ichimoku returns a tuple of DFs. We need to extract what we need.
    # Usually it returns (stats_df, span_df).
    # We'll just grab it manually later or assign to df if specific columns needed.
    # For now, let's keep it simple or extract specifically.
    # pandas_ta appends if append=True. Let's check output columns.
    # ITS_9_26_52_26, IKS_9_26_52_26 (Kijun)
    # Ichimoku Base Line is Kijun-sen.
    
    # VWMA (20)
    df.ta.vwma(length=20, append=True)

    # Map generic names for chart compatibility (safely)
    # pandas_ta automatically names them SMA_50, SMA_200, etc.
    # We only need to check if they exist (they might not if data < length)
    
    # Aliasing complex names to simple ones for frontend/downstream
    if 'MACD_12_26_9' in df.columns: df['MACD'] = df['MACD_12_26_9']
    if 'MACDs_12_26_9' in df.columns: df['MACD_Signal'] = df['MACDs_12_26_9']
    if 'MACDh_12_26_9' in df.columns: df['MACD_Hist'] = df['MACDh_12_26_9']
    if 'RSI_14' in df.columns: df['RSI'] = df['RSI_14']
    
    # Ensure standard SMA names are accessible if they exist (pandas_ta creates them, but explicit alias ensures existing refs work)
    # Actually, pandas_ta creates columns named "SMA_50", etc. 
    # The lines assigning df['SMA_50'] = df['SMA_50'] were likely redundant or intended to fail fast.
    # We can safely remove the self-assignments as they serve no purpose if the name is identical, 
    # but removing them avoids the KeyError if the column is missing.
    pass

    # Support/Resistance Helpers (keep existing logic)
    # Support/Resistance Helpers (keep existing logic)
    # Safe access again (pandas_ta is relentless with lowercasing)
    l_safe = 'Low' if 'Low' in df.columns else 'low'
    if l_safe not in df.columns: l_safe = 'Close' if 'Close' in df.columns else 'close'
    
    h_safe = 'High' if 'High' in df.columns else 'high'
    if h_safe not in df.columns: h_safe = 'Close' if 'Close' in df.columns else 'close'

    if l_safe in df.columns:
        df['Min_20'] = df[l_safe].rolling(window=20, center=True).min()
    
    if h_safe in df.columns:
        df['Max_20'] = df[h_safe].rolling(window=20, center=True).max()
    
    # --- FINAL SANITIZATION ---
    # Ensure OHLCV are Title Case for app_US.py
    # pandas_ta likely lowercased them. We MUST revert this for compatibility.
    final_rename = {}
    for c in df.columns:
        if c.lower() == 'open': final_rename[c] = 'Open'
        elif c.lower() == 'high': final_rename[c] = 'High'
        elif c.lower() == 'low': final_rename[c] = 'Low'
        elif c.lower() == 'close': final_rename[c] = 'Close'
        elif c.lower() == 'volume': final_rename[c] = 'Volume'
        
    if final_rename:
        df = df.rename(columns=final_rename)

    return df

def get_signal(value, indicator_type, **kwargs):
    """
    Determine simple Buy/Sell/Neutral signal.
    """
    try:
        val = float(value)
    except:
        return 'Neutral'

    if indicator_type == 'RSI':
        if val < 30: return 'Buy'
        if val > 70: return 'Sell'
    elif indicator_type == 'STOCH':
        if val < 20: return 'Buy'
        if val > 80: return 'Sell'
    elif indicator_type == 'CCI':
        if val < -100: return 'Buy'
        if val > 100: return 'Sell'
    elif indicator_type == 'AO':
        if val > 0 and kwargs.get('prev') and kwargs['prev'] < 0: return 'Buy' # Crossover
        if val < 0 and kwargs.get('prev') and kwargs['prev'] > 0: return 'Sell' # Crossunder
    elif indicator_type == 'MOM':
        if val > 0: return 'Buy' # Generally
        if val < 0: return 'Sell'
    elif indicator_type == 'MACD':
        if val > kwargs.get('signal_line', 0): return 'Buy'
        if val < kwargs.get('signal_line', 0): return 'Sell'
    elif indicator_type == 'MA_CROSS':
        # Price vs MA
        price = kwargs.get('price')
        if price > val: return 'Buy'
        if price < val: return 'Sell'
        
    return 'Neutral'

def get_ta_summary(df):
    """
    Generate the detailed summary dict for the latest values.
    """
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    price = latest['Close']
    
    # Helper to safe get
    def get(col, default=0):
        val = latest.get(col, default)
        if pd.isna(val) or val is None:
             return None
        return val

    # --- Oscillators Data ---
    oscillators = []
    
    # 1. RSI
    rsi_val = get('RSI_14')
    oscillators.append({'name': 'Relative Strength Index (14)', 'value': rsi_val, 'action': get_signal(rsi_val, 'RSI')})
    
    # 2. Stochastic %K
    stoch_k = get('STOCHk_14_3_3')
    oscillators.append({'name': 'Stochastic %K (14, 3, 3)', 'value': stoch_k, 'action': get_signal(stoch_k, 'STOCH')})
    
    # 3. CCI
    cci_val = get('CCI_20_0.015')
    oscillators.append({'name': 'Commodity Channel Index (20)', 'value': cci_val, 'action': get_signal(cci_val, 'CCI')})
    
    # 4. ADX
    adx_val = get('ADX_14')
    # Simple rule: ADX > 25 = Strong Trend. 
    oscillators.append({'name': 'Average Directional Index (14)', 'value': adx_val, 'action': 'Neutral'}) 
    
    # 5. Awesome Oscillator
    ao_val = get('AO_5_34')
    ao_prev = prev.get('AO_5_34', 0)
    oscillators.append({'name': 'Awesome Oscillator', 'value': ao_val, 'action': get_signal(ao_val, 'AO', prev=ao_prev)})
    
    # 6. Momentum
    mom_val = get('MOM_10')
    oscillators.append({'name': 'Momentum (10)', 'value': mom_val, 'action': get_signal(mom_val, 'MOM')})
    
    # 7. MACD Level
    macd_val = get('MACD_12_26_9')
    macd_sig = get('MACDs_12_26_9')
    oscillators.append({'name': 'MACD Level (12, 26)', 'value': macd_val, 'action': get_signal(macd_val, 'MACD', signal_line=macd_sig)})
    
    # 8. Stochastic RSI Fast
    stochrsi_k = get('STOCHRSIk_14_14_3_3')
    oscillators.append({'name': 'Stochastic RSI Fast (3, 3, 14, 14)', 'value': stochrsi_k, 'action': get_signal(stochrsi_k, 'STOCH')})
    
    # 9. Williams %R
    willr_val = get('WILLR_14')
    # Williams is -0 to -100. > -20 Sell, < -80 Buy.
    w_action = 'Neutral'
    if willr_val is not None:
        if willr_val > -20: w_action = 'Sell'
        if willr_val < -80: w_action = 'Buy'
    oscillators.append({'name': 'Williams Percent Range (14)', 'value': willr_val, 'action': w_action})
    
    # 10. Bull Bear Power
    bbp_val = get('BBP')
    bbp_action = 'Neutral'
    if bbp_val is not None:
        bbp_action = 'Buy' if bbp_val > 0 else 'Sell'
    oscillators.append({'name': 'Bull Bear Power', 'value': bbp_val, 'action': bbp_action})
    
    # 11. Ultimate Oscillator
    uo_val = get('UO_7_14_28')
    # UO > 70 Sell, < 30 Buy
    uo_action = 'Neutral'
    if uo_val is not None:
        if uo_val > 70: uo_action = 'Sell'
        if uo_val < 30: uo_action = 'Buy'
    oscillators.append({'name': 'Ultimate Oscillator (7, 14, 28)', 'value': uo_val, 'action': uo_action})


    # --- Moving Averages Data ---
    mas = []
    
    ma_periods = [10, 20, 30, 50, 100, 200]
    for p in ma_periods:
        # EMA
        ema_val = get(f'EMA_{p}')
        mas.append({'name': f'Exponential Moving Average ({p})', 'value': ema_val, 'action': get_signal(ema_val, 'MA_CROSS', price=price)})
        # SMA
        sma_val = get(f'SMA_{p}')
        mas.append({'name': f'Simple Moving Average ({p})', 'value': sma_val, 'action': get_signal(sma_val, 'MA_CROSS', price=price)})

    # Ichimoku Base Line (Kijun-sen)
    ksi_val = get('IKS_26')
    mas.append({'name': 'Ichimoku Base Line (9, 26, 52, 26)', 'value': ksi_val, 'action': 'Neutral'})

    # VWMA
    vwma_val = get('VWMA_20')
    mas.append({'name': 'Volume Weighted Moving Average (20)', 'value': vwma_val, 'action': get_signal(vwma_val, 'MA_CROSS', price=price)})

    # --- Aggregation / Rating Logic ---
    buy_count = 0
    sell_count = 0
    neutral_count = 0
    
    all_indicators = oscillators + mas
    for ind in all_indicators:
        a = ind['action']
        if a == 'Buy': buy_count += 1
        elif a == 'Sell': sell_count += 1
        else: neutral_count += 1
        
    total = buy_count + sell_count + neutral_count
    
    # Simple Rating Logic (similar to TV)
    # Strong Buy: Buy > Sell & Buy ratio high
    # Buy: Buy > Sell
    # Neutral: Buy ~ Sell
    
    recommendation = "Neutral"
    if total > 0:
        # Check Strong conditions first
        if buy_count > sell_count and buy_count >= (total * 0.45):
             recommendation = "Buy"
             if buy_count >= (total * 0.6):
                 recommendation = "Strong Buy"
        elif sell_count > buy_count and sell_count >= (total * 0.45):
             recommendation = "Sell"
             if sell_count >= (total * 0.6):
                 recommendation = "Strong Sell"
    
    analysis = {
        'recommendation': recommendation,
        'buy': buy_count,
        'sell': sell_count,
        'neutral': neutral_count
    }

    return {
        'price': price,
        'oscillators': oscillators,
        'moving_averages': mas,
        'analysis': analysis
    }

def get_fibonacci_levels(df):
    """
    Calculate Fibonacci Retracement levels from 6-month high/low.
    """
    if df.empty:
        return {}
        
    six_months_ago = df.index[-1] - timedelta(days=180)
    recent_df = df[df.index >= six_months_ago]
    
    if recent_df.empty:
        return {}
        
    period_high = recent_df['High'].max()
    period_low = recent_df['Low'].min()
    diff = period_high - period_low
    
    return {
        '0.0% (High)': period_high if not pd.isna(period_high) else None,
        '23.6%': period_high - diff * 0.236 if not pd.isna(period_high) else None,
        '38.2%': period_high - diff * 0.382 if not pd.isna(period_high) else None,
        '50.0%': period_high - diff * 0.5 if not pd.isna(period_high) else None,
        '61.8%': period_high - diff * 0.618 if not pd.isna(period_high) else None,
        '100.0% (Low)': period_low if not pd.isna(period_low) else None
    }

def get_support_resistance(df):
    """
    Identify recent support and resistance levels.
    """
    supports = df[df['Low'] == df['Min_20']]['Low'].tail(5).tolist()
    resistances = df[df['High'] == df['Max_20']]['High'].tail(5).tolist()
    
    return {
        'supports': sorted(list(set([round(x, 2) for x in supports]))),
        'resistances': sorted(list(set([round(x, 2) for x in resistances])), reverse=True)
    }

def prepare_df_for_llm(df, last_n=50):
    """
    Format the last N rows of the DataFrame into a CSV-like string for the LLM.
    Includes Price, RSI, MACD, Bollinger/ATR (if avail), SMAs.
    """
    if df.empty:
        return "No Data"
    
    # Select relevant columns if they exist
    cols = ['Open', 'High', 'Low', 'Close', 'Volume']
    # Ensure correct column names from calculate_technical_indicators
    indicators = [
        # Oscillators
        'RSI_14', 'STOCHk_14_3_3', 'CCI_20_0.015', 'ADX_14', 'AO_5_34', 'MOM_10', 
        'MACD_12_26_9', 'MACDs_12_26_9', 'MACDh_12_26_9', 'STOCHRSIk_14_14_3_3', 
        'WILLR_14', 'BBP', 'UO_7_14_28',
        # Moving Averages
        'EMA_10', 'SMA_10', 'EMA_20', 'SMA_20', 'EMA_30', 'SMA_30', 
        'EMA_50', 'SMA_50', 'EMA_100', 'SMA_100', 'EMA_200', 'SMA_200',
        'IKS_26', 'VWMA_20'
    ]
    
    existing_cols = [c for c in cols + indicators if c in df.columns]
    
    subset = df[existing_cols].tail(last_n).copy()
    
    # Round for compactness
    subset = subset.round(2)
    
    # Convert to CSV string
    return subset.to_csv(index=True)
