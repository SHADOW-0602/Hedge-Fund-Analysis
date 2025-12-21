
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import timedelta

def calculate_technical_indicators(df):
    """
    Calculate generic technical indicators for a given DataFrame.
    """
    if df.empty:
        return df

    # 1. Moving Averages
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    df['SMA_200'] = df['Close'].rolling(window=200).mean()
    
    # 2. MACD (12, 26, 9)
    k = df['Close'].ewm(span=12, adjust=False, min_periods=12).mean()
    d = df['Close'].ewm(span=26, adjust=False, min_periods=26).mean()
    df['MACD'] = k - d
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False, min_periods=9).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
    
    # 3. RSI (14)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))

    # 4. Support & Resistance (Simple Local Extrema)
    df['Min_20'] = df['Low'].rolling(window=20, center=True).min()
    df['Max_20'] = df['High'].rolling(window=20, center=True).max()
    
    return df

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

def get_ta_summary(df):
    """
    Generate a simple summary dict for the latest values.
    """
    latest = df.iloc[-1]
    return {
        'price': latest['Close'],
        'rsi': latest['RSI'] if not pd.isna(latest['RSI']) else 0,
        'macd_action': 'Bullish' if latest['MACD'] > latest['MACD_Signal'] else 'Bearish',
        'sma_trend': 'Bullish' if latest['Close'] > latest['SMA_200'] else 'Bearish'
    }
