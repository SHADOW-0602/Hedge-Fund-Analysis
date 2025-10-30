"""
Automatic Analysis Utilities
Handles automatic news sentiment and Monte Carlo analysis
"""

import hashlib
from typing import List, Dict, Optional
import streamlit as st
from utils.cache_manager import cache_manager


def run_automatic_sentiment_analysis(portfolio_symbols: List[str], user_id: str, days_back: int = 7) -> Optional[Dict]:
    """
    Run automatic news sentiment analysis for portfolio symbols
    
    Args:
        portfolio_symbols: List of stock symbols
        user_id: User identifier for caching
        days_back: Number of days to look back for news
    
    Returns:
        Dictionary with sentiment data or None if failed
    """
    try:
        from pulling_news_v3 import NewsAnalyzer
        
        news_analyzer = NewsAnalyzer()
        sentiment_data = news_analyzer.get_portfolio_news_sentiment(portfolio_symbols, days_back)
        
        # Cache results
        sentiment_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
        cache_manager.set_portfolio_data(user_id, f"sentiment_{sentiment_hash}", sentiment_data, expire_hours=6)
        
        return sentiment_data
    
    except Exception as e:
        st.warning(f"Sentiment analysis failed: {str(e)}")
        return None


def run_automatic_monte_carlo(portfolio_symbols: List[str], weights: Dict[str, float], user_id: str, 
                            time_horizon: int = 252, num_simulations: int = 5000) -> Optional[Dict]:
    """
    Run automatic Monte Carlo simulation for portfolio
    
    Args:
        portfolio_symbols: List of stock symbols
        weights: Portfolio weights dictionary
        user_id: User identifier for caching
        time_horizon: Simulation time horizon in days
        num_simulations: Number of Monte Carlo simulations
    
    Returns:
        Dictionary with Monte Carlo results or None if failed
    """
    try:
        from monte_carlo_v3 import MonteCarloEngine
        from clients.market_data_client import MarketDataClient
        
        data_client = MarketDataClient()
        mc_engine = MonteCarloEngine(data_client)
        
        mc_results = mc_engine.portfolio_simulation(
            portfolio_symbols, weights, time_horizon, num_simulations
        )
        
        # Cache results
        mc_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
        cache_manager.set_portfolio_data(user_id, f"monte_carlo_{mc_hash}", mc_results, expire_hours=12)
        
        return mc_results
    
    except Exception as e:
        st.warning(f"Monte Carlo simulation failed: {str(e)}")
        return None


def get_cached_sentiment_analysis(portfolio_symbols: List[str], user_id: str) -> Optional[Dict]:
    """Get cached sentiment analysis results"""
    sentiment_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
    return cache_manager.get_portfolio_data(user_id, f"sentiment_{sentiment_hash}")


def get_cached_monte_carlo(portfolio_symbols: List[str], user_id: str) -> Optional[Dict]:
    """Get cached Monte Carlo results"""
    mc_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
    return cache_manager.get_portfolio_data(user_id, f"monte_carlo_{mc_hash}")


def format_sentiment_summary(sentiment_data: Dict) -> Dict:
    """
    Format sentiment data for display
    
    Args:
        sentiment_data: Raw sentiment data from NewsAnalyzer
    
    Returns:
        Formatted summary with counts and insights
    """
    if not sentiment_data:
        return {"bullish": 0, "bearish": 0, "neutral": 0, "insights": []}
    
    bullish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BULLISH')
    bearish_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'BEARISH')
    neutral_count = sum(1 for data in sentiment_data.values() if data['sentiment_trend'] == 'NEUTRAL')
    
    # Generate insights
    insights = []
    total_stocks = len(sentiment_data)
    
    if bullish_count > bearish_count * 2:
        insights.append("📈 Strong bullish sentiment across portfolio")
    elif bearish_count > bullish_count * 2:
        insights.append("📉 Concerning bearish sentiment detected")
    else:
        insights.append("⚖️ Mixed sentiment signals")
    
    if total_stocks > 0:
        news_coverage = sum(data['news_count'] for data in sentiment_data.values()) / total_stocks
        if news_coverage > 10:
            insights.append("📰 High news coverage - increased volatility expected")
        elif news_coverage < 2:
            insights.append("🔇 Low news coverage - limited market attention")
    
    return {
        "bullish": bullish_count,
        "bearish": bearish_count,
        "neutral": neutral_count,
        "insights": insights,
        "total_news": sum(data['news_count'] for data in sentiment_data.values())
    }


def format_monte_carlo_summary(mc_results: Dict) -> Dict:
    """
    Format Monte Carlo results for display
    
    Args:
        mc_results: Raw Monte Carlo results
    
    Returns:
        Formatted summary with risk assessment and insights
    """
    if not mc_results:
        return {"risk_level": "UNKNOWN", "insights": []}
    
    prob_loss = mc_results.get('probability_loss', 0)
    expected_return = mc_results.get('expected_return', 0)
    volatility = mc_results.get('volatility', 0)
    percentiles = mc_results.get('percentiles', {})
    
    # Risk assessment
    if prob_loss < 0.2:
        risk_level = "LOW"
        risk_color = "🟢"
    elif prob_loss < 0.4:
        risk_level = "MODERATE"
        risk_color = "🟡"
    else:
        risk_level = "HIGH"
        risk_color = "🔴"
    
    # Generate insights
    insights = []
    
    # Return insights
    if expected_return > 0.15:
        insights.append("🚀 High expected returns projected")
    elif expected_return > 0.08:
        insights.append("📈 Moderate growth expected")
    elif expected_return < 0:
        insights.append("⚠️ Negative expected returns")
    
    # Volatility insights
    if volatility > 0.25:
        insights.append("🌊 High volatility - expect significant price swings")
    elif volatility < 0.15:
        insights.append("🛡️ Low volatility - stable price movements expected")
    
    # Downside protection
    fifth_percentile = percentiles.get('5th', 0)
    if fifth_percentile > 0.9:
        insights.append("✅ Strong downside protection")
    elif fifth_percentile < 0.7:
        insights.append("⚠️ Significant downside risk")
    
    # Upside potential
    ninety_fifth_percentile = percentiles.get('95th', 1)
    if ninety_fifth_percentile > 1.5:
        insights.append("🎯 Excellent upside potential")
    elif ninety_fifth_percentile < 1.2:
        insights.append("📊 Limited upside potential")
    
    return {
        "risk_level": risk_level,
        "risk_color": risk_color,
        "probability_loss": prob_loss,
        "expected_return": expected_return,
        "volatility": volatility,
        "insights": insights,
        "percentiles": percentiles
    }


def refresh_all_analysis(portfolio_symbols: List[str], weights: Dict[str, float], user_id: str) -> Dict:
    """
    Refresh both sentiment and Monte Carlo analysis
    
    Args:
        portfolio_symbols: List of stock symbols
        weights: Portfolio weights
        user_id: User identifier
    
    Returns:
        Dictionary with success status and results
    """
    results = {"sentiment_success": False, "monte_carlo_success": False}
    
    # Clear existing cache
    sentiment_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
    mc_hash = hashlib.md5(str(sorted(portfolio_symbols)).encode()).hexdigest()
    
    cache_manager.delete_cache_key(user_id, f"sentiment_{sentiment_hash}")
    cache_manager.delete_cache_key(user_id, f"monte_carlo_{mc_hash}")
    
    # Run sentiment analysis
    sentiment_data = run_automatic_sentiment_analysis(portfolio_symbols, user_id)
    if sentiment_data:
        results["sentiment_success"] = True
        results["sentiment_data"] = sentiment_data
    
    # Run Monte Carlo
    mc_data = run_automatic_monte_carlo(portfolio_symbols, weights, user_id)
    if mc_data:
        results["monte_carlo_success"] = True
        results["monte_carlo_data"] = mc_data
    
    return results