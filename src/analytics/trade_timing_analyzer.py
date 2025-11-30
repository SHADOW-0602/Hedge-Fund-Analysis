import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any
import pytz

class TradeTimingAnalyzer:
    """Analyze trade timing patterns and performance"""
    
    def __init__(self, data_client):
        self.data_client = data_client
        
    def analyze_trade_timing(self, transactions, period='1Y', time_buckets='All', 
                           day_analysis='All', market_conditions='All', performance_view='Combined'):
        """Comprehensive trade timing analysis"""
        
        # Convert transactions to DataFrame
        df = self._transactions_to_df(transactions)
        
        # Filter by period
        df = self._filter_by_period(df, period)
        
        # Add timing features
        df = self._add_timing_features(df)
        
        # Get market data for performance calculation
        df = self._add_market_performance(df)
        
        # Analyze time buckets
        time_bucket_performance = self._analyze_time_buckets(df, time_buckets)
        
        # Analyze day of week
        day_performance = self._analyze_day_of_week(df, day_analysis)
        
        # Analyze market conditions
        market_condition_performance = self._analyze_market_conditions(df, market_conditions)
        
        # Combined performance metrics
        combined_performance = self._calculate_combined_performance(df, performance_view)
        
        # Summary statistics
        summary = self._calculate_summary(df)
        
        # Safe date range for parameters
        try:
            start_date = df['date'].min()
            end_date = df['date'].max()
            if pd.notna(start_date) and pd.notna(end_date):
                date_range_str = f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
            else:
                date_range_str = "N/A"
        except:
            date_range_str = "N/A"
        
        return {
            'time_bucket_performance': time_bucket_performance,
            'day_performance': day_performance,
            'market_condition_performance': market_condition_performance,
            'combined_performance': combined_performance,
            'summary': summary,
            'parameters': {
                'period': period,
                'time_buckets': time_buckets,
                'day_analysis': day_analysis,
                'market_conditions': market_conditions,
                'performance_view': performance_view,
                'total_trades': len(df),
                'date_range': date_range_str
            }
        }
    
    def _transactions_to_df(self, transactions):
        """Convert transactions to DataFrame"""
        data = []
        for tx in transactions:
            data.append({
                'symbol': tx.symbol,
                'quantity': tx.quantity,
                'price': tx.price,
                'date': tx.date,
                'transaction_type': tx.transaction_type,
                'fees': tx.fees,
                'value': abs(tx.quantity * tx.price)
            })
        return pd.DataFrame(data)
    
    def _filter_by_period(self, df, period):
        """Filter transactions by period"""
        if period == 'All' or len(df) == 0:
            return df
            
        end_date = datetime.now()
        
        if period == '1M':
            start_date = end_date - timedelta(days=30)
        elif period == '3M':
            start_date = end_date - timedelta(days=90)
        elif period == '6M':
            start_date = end_date - timedelta(days=180)
        elif period == '1Y':
            start_date = end_date - timedelta(days=365)
        else:
            return df
        
        # Convert df['date'] to datetime and make timezone-naive
        df_copy = df.copy()
        df_copy['date'] = pd.to_datetime(df_copy['date'])
        
        # Make both dates timezone-naive for comparison
        if df_copy['date'].dt.tz is not None:
            df_copy['date'] = df_copy['date'].dt.tz_localize(None)
        
        # Filter by period - no fallback
        return df_copy[df_copy['date'] >= start_date]
    
    def _add_timing_features(self, df):
        """Add timing-related features"""
        if len(df) == 0:
            return df
            
        df = df.copy()
        
        # Convert to EST for market hours - assume input is already EST
        df['date_est'] = pd.to_datetime(df['date'])
        
        # Time buckets
        df['hour'] = df['date_est'].dt.hour
        df['time_bucket'] = df['hour'].apply(self._get_time_bucket)
        
        # Day of week
        df['day_of_week'] = df['date_est'].dt.day_name()
        df['weekday'] = df['date_est'].dt.weekday  # 0=Monday, 6=Sunday
        
        return df
    
    def _get_time_bucket(self, hour):
        """Classify hour into time bucket (EST)"""
        if hour == 9:
            return 'Market Open'
        elif 10 <= hour <= 14:
            return 'Mid-day'
        elif hour == 15:
            return 'Close'
        else:
            return 'After-hours'
    
    def _add_market_performance(self, df):
        """Add market performance data for each trade"""
        if len(df) == 0:
            return df
            
        df = df.copy()
        
        # Get SPY data for market performance comparison - no fallback
        spy_data = self.data_client.get_price_data(['SPY'], period='2y')
        if spy_data is not None and not spy_data.empty:
            # Handle different column structures
            if 'SPY' in spy_data.columns:
                spy_prices = spy_data['SPY']
            elif len(spy_data.columns) == 1:
                spy_prices = spy_data.iloc[:, 0]
            else:
                # No valid SPY data
                return df
                
            spy_returns = spy_prices.pct_change()
            spy_df = pd.DataFrame({
                'date': pd.to_datetime(spy_data.index).date,
                'spy_return': spy_returns
            })
            
            # Merge with transactions
            df['trade_date'] = df['date_est'].dt.date
            df = df.merge(spy_df, left_on='trade_date', right_on='date', how='left')
            
            # Classify market conditions - only for trades with SPY data
            df['market_condition'] = df['spy_return'].apply(self._classify_market_condition)
        else:
            # No SPY data available - don't add market condition column
            pass
        
        return df
    
    def _classify_market_condition(self, spy_return):
        """Classify market condition based on SPY return"""
        if pd.isna(spy_return):
            return 'Normal'
        elif spy_return > 0.02:
            return 'Up days'
        elif spy_return < -0.02:
            return 'Down days'
        elif abs(spy_return) > 0.015:
            return 'Volatile days'
        else:
            return 'Normal'
    
    def _analyze_time_buckets(self, df, time_buckets_filter):
        """Analyze performance by time buckets"""
        # Only analyze if time_bucket column exists
        if 'time_bucket' not in df.columns:
            return {}
            
        if time_buckets_filter != 'All':
            df_filtered = df[df['time_bucket'] == time_buckets_filter]
        else:
            df_filtered = df
        
        bucket_stats = {}
        for bucket in ['Market Open', 'Mid-day', 'Close', 'After-hours']:
            bucket_df = df_filtered[df_filtered['time_bucket'] == bucket]
            if len(bucket_df) > 0:
                bucket_stats[bucket] = {
                    'trade_count': len(bucket_df),
                    'total_value': bucket_df['value'].sum(),
                    'avg_trade_size': bucket_df['value'].mean(),
                    'buy_trades': len(bucket_df[bucket_df['transaction_type'] == 'BUY']),
                    'sell_trades': len(bucket_df[bucket_df['transaction_type'] == 'SELL']),
                    'performance_score': self._calculate_bucket_performance(bucket_df)
                }
        
        return bucket_stats
    
    def _analyze_day_of_week(self, df, day_filter):
        """Analyze performance by day of week"""
        # Only analyze if day_of_week column exists
        if 'day_of_week' not in df.columns:
            return {}
            
        if day_filter != 'All':
            df_filtered = df[df['day_of_week'] == day_filter]
        else:
            df_filtered = df
        
        day_stats = {}
        for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
            day_df = df_filtered[df_filtered['day_of_week'] == day]
            # Include all weekdays, even with 0 trades
            day_stats[day] = {
                'trade_count': len(day_df),
                'total_value': day_df['value'].sum() if len(day_df) > 0 else 0,
                'avg_trade_size': day_df['value'].mean() if len(day_df) > 0 else 0,
                'buy_trades': len(day_df[day_df['transaction_type'] == 'BUY']) if len(day_df) > 0 else 0,
                'sell_trades': len(day_df[day_df['transaction_type'] == 'SELL']) if len(day_df) > 0 else 0,
                'performance_score': self._calculate_bucket_performance(day_df)
            }
        
        return day_stats
    
    def _analyze_market_conditions(self, df, conditions_filter):
        """Analyze performance by market conditions"""
        # Only analyze if market_condition column exists (SPY data available)
        if 'market_condition' not in df.columns:
            return {}
            
        if conditions_filter != 'All':
            df_filtered = df[df['market_condition'] == conditions_filter]
        else:
            df_filtered = df
        
        condition_stats = {}
        # Only check conditions that actually exist in the data
        if 'market_condition' in df_filtered.columns and len(df_filtered) > 0:
            unique_conditions = df_filtered['market_condition'].unique()
        else:
            unique_conditions = []
            
        for condition in unique_conditions:
            condition_df = df_filtered[df_filtered['market_condition'] == condition]
            if len(condition_df) > 0:
                condition_stats[condition] = {
                    'trade_count': len(condition_df),
                    'total_value': condition_df['value'].sum(),
                    'avg_trade_size': condition_df['value'].mean(),
                    'buy_trades': len(condition_df[condition_df['transaction_type'] == 'BUY']),
                    'sell_trades': len(condition_df[condition_df['transaction_type'] == 'SELL']),
                    'performance_score': self._calculate_bucket_performance(condition_df),
                    'avg_market_return': condition_df['spy_return'].mean() if 'spy_return' in condition_df else 0
                }
        
        return condition_stats
    
    def _calculate_bucket_performance(self, bucket_df):
        """Calculate performance score for a bucket"""
        if len(bucket_df) == 0:
            return 0
        
        # Simple performance metric based on trade frequency and size
        trade_frequency = len(bucket_df)
        avg_size = bucket_df['value'].mean()
        
        # Normalize and combine metrics
        performance = (trade_frequency * 0.6) + (avg_size / 10000 * 0.4)
        return min(performance, 100)  # Cap at 100
    
    def _calculate_combined_performance(self, df, view):
        """Calculate combined performance metrics"""
        combined = {}
        
        if view in ['Combined', 'By time'] and 'time_bucket' in df.columns and len(df) > 0:
            # Time-based performance
            time_performance = {}
            for bucket in df['time_bucket'].unique():
                bucket_df = df[df['time_bucket'] == bucket]
                time_performance[bucket] = {
                    'trade_count': len(bucket_df),
                    'total_value': bucket_df['value'].sum(),
                    'performance_score': self._calculate_bucket_performance(bucket_df)
                }
            combined['by_time'] = time_performance
        
        if view in ['Combined', 'By day'] and 'day_of_week' in df.columns and len(df) > 0:
            # Day-based performance
            day_performance = {}
            for day in df['day_of_week'].unique():
                day_df = df[df['day_of_week'] == day]
                day_performance[day] = {
                    'trade_count': len(day_df),
                    'total_value': day_df['value'].sum(),
                    'performance_score': self._calculate_bucket_performance(day_df)
                }
            combined['by_day'] = day_performance
        
        return combined
    
    def _calculate_summary(self, df):
        """Calculate summary statistics"""
        # Safe date formatting
        try:
            start_date = df['date'].min()
            end_date = df['date'].max()
            date_range = {
                'start': start_date.strftime('%Y-%m-%d') if pd.notna(start_date) else 'N/A',
                'end': end_date.strftime('%Y-%m-%d') if pd.notna(end_date) else 'N/A'
            }
        except:
            date_range = {'start': 'N/A', 'end': 'N/A'}
        
        return {
            'total_trades': len(df),
            'total_value': df['value'].sum(),
            'avg_trade_size': df['value'].mean(),
            'date_range': date_range,
            'most_active_time': df['time_bucket'].mode().iloc[0] if 'time_bucket' in df.columns and not df['time_bucket'].mode().empty else 'N/A',
            'most_active_day': df['day_of_week'].mode().iloc[0] if 'day_of_week' in df.columns and not df['day_of_week'].mode().empty else 'N/A',
            'buy_sell_ratio': len(df[df['transaction_type'] == 'BUY']) / max(len(df[df['transaction_type'] == 'SELL']), 1)
        }