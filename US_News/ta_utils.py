import pandas as pd
import numpy as np
import pandas_ta as ta
from datetime import timedelta

def calculate_technical_indicators(df):
    """
    Calculate comprehensive technical indicators using pandas_ta.
    """
    if df.empty:
        return df

    # --- Oscillators ---
    # RSI (14)
    df.ta.rsi(length=14, append=True)
    
    # Stochastic %K (14, 3, 3)
    df.ta.stoch(k=14, d=3, smooth_k=3, append=True)
    
    # CCI (20)
    df.ta.cci(length=20, append=True)
    
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
    df['BBP'] = (df['High'] - ema13) + (df['Low'] - ema13)

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

    # Map generic names for chart compatibility (keeping old code working)
    df['SMA_50'] = df['SMA_50']
    df['SMA_200'] = df['SMA_200']
    df['MACD'] = df['MACD_12_26_9']
    df['MACD_Signal'] = df['MACDs_12_26_9']
    df['MACD_Hist'] = df['MACDh_12_26_9']
    df['RSI'] = df['RSI_14']

    # Support/Resistance Helpers (keep existing logic)
    df['Min_20'] = df['Low'].rolling(window=20, center=True).min()
    df['Max_20'] = df['High'].rolling(window=20, center=True).max()
    
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
        return latest.get(col, default)

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
    if willr_val > -20: w_action = 'Sell'
    if willr_val < -80: w_action = 'Buy'
    oscillators.append({'name': 'Williams Percent Range (14)', 'value': willr_val, 'action': w_action})
    
    # 10. Bull Bear Power
    bbp_val = get('BBP')
    oscillators.append({'name': 'Bull Bear Power', 'value': bbp_val, 'action': 'Buy' if bbp_val > 0 else 'Sell'})
    
    # 11. Ultimate Oscillator
    uo_val = get('UO_7_14_28')
    # UO > 70 Sell, < 30 Buy
    uo_action = 'Neutral'
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


    return {
        'price': price,
        'rsi': rsi_val,
        'macd_action': 'Bullish' if macd_val > macd_sig else 'Bearish',
        'sma_trend': 'Bullish' if price > get('SMA_200') else 'Bearish',
        'oscillators': oscillators,
        'moving_averages': mas
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
        '0.0% (High)': period_high,
        '23.6%': period_high - diff * 0.236,
        '38.2%': period_high - diff * 0.382,
        '50.0%': period_high - diff * 0.5,
        '61.8%': period_high - diff * 0.618,
        '100.0% (Low)': period_low
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
