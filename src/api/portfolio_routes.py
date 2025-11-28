"""
Modular Portfolio Routes
This file imports and registers all portfolio-related routes from separate modules
"""

from .portfolio_management_routes import register_portfolio_management_routes
from .analytics_routes import register_analytics_routes
from .options_routes import register_options_routes
from .transaction_analysis_routes import register_transaction_analysis_routes
from .technical_analysis_routes import register_technical_analysis_routes
from .comprehensive_analysis_routes import register_comprehensive_analysis_routes
from .tax_routes import register_tax_routes
from .drawdown_routes import register_drawdown_routes
from .trade_timing_routes import register_trade_timing_routes

def register_portfolio_routes(app, data_client, smart_cache=None):
    """
    Register all portfolio-related routes by importing from modular route files
    
    This replaces the monolithic portfolio_routes.py with a modular architecture:
    - Portfolio Management: upload, save, load, delete portfolios
    - Analytics: risk analysis, Monte Carlo, performance attribution, optimization
    - Options: options scanning and analysis
    - Transaction Analysis: return attribution and transaction-based analytics
    - Technical Analysis: technical indicators and signals
    - Comprehensive Analysis: backtesting, statistical analysis, correlation, sector allocation
    """
    
    # Register all route modules
    register_portfolio_management_routes(app, data_client, smart_cache)
    register_analytics_routes(app, data_client, smart_cache)
    register_options_routes(app, data_client, smart_cache)
    register_transaction_analysis_routes(app, data_client, smart_cache)
    register_technical_analysis_routes(app, data_client, smart_cache)
    register_comprehensive_analysis_routes(app, data_client, smart_cache)
    register_tax_routes(app, data_client, smart_cache)
    register_drawdown_routes(app, data_client, smart_cache)
    register_trade_timing_routes(app, data_client, smart_cache)
    
    print("[SUCCESS] All modular portfolio routes registered successfully")
    print("[INFO] Route modules loaded:")
    print("   - Portfolio Management (upload, save, load, delete)")
    print("   - Analytics (risk, Monte Carlo, performance attribution, optimization)")
    print("   - Options (scanning and analysis)")
    print("   - Transaction Analysis (return attribution)")
    print("   - Technical Analysis (indicators and signals)")
    print("   - Comprehensive Analysis (backtesting, statistical, correlation, sector)")
    print("   - Tax Analysis (tax liability, wash sales, loss harvesting)")
    print("   - Drawdown Analysis (max drawdown, recovery time, periods)")
    print("   - Trade Timing Analysis (time buckets, day of week, market conditions)")