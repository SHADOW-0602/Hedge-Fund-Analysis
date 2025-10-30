#!/usr/bin/env python3
"""Check dependencies and API keys for new portfolio analysis features"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def check_dependencies():
    """Check if required packages are installed"""
    required_packages = {
        'cvxpy': 'Portfolio optimization (mean-variance)',
        'scipy': 'Optimization algorithms', 
        'sklearn': 'Factor model regression',
        'yfinance': 'Market data and company info',
        'pandas': 'Data manipulation',
        'numpy': 'Numerical computations'
    }
    
    missing_packages = []
    
    for package, description in required_packages.items():
        try:
            __import__(package)
            print(f"OK {package} - {description}")
        except ImportError:
            print(f"MISSING {package} - {description}")
            missing_packages.append(package)
    
    return missing_packages

def check_api_keys():
    """Check API key availability"""
    try:
        from src.utils.config import Config
    except ImportError:
        # Fallback to direct environment variable check
        import os
        Config = type('Config', (), {})
        Config.FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')
        Config.POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')
        Config.ALPHA_VANTAGE_API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY')
        Config.TWELVE_DATA_API_KEY = os.getenv('TWELVE_DATA_API_KEY')

    
    api_keys = {
        'FINNHUB_API_KEY': 'Enhanced sector/company data',
        'POLYGON_API_KEY': 'Alternative market data',
        'ALPHA_VANTAGE_API_KEY': 'Fundamental data',
        'TWELVE_DATA_API_KEY': 'Real-time market data',

    }
    
    print("\nAPI Key Status:")
    for key, description in api_keys.items():
        value = getattr(Config, key, None)
        if value:
            print(f"OK {key} - {description}")
        else:
            print(f"MISSING {key} - {description} (Optional)")

def main():
    print("Checking Portfolio Analysis Dependencies...")
    
    missing = check_dependencies()
    check_api_keys()
    
    if missing:
        print(f"\nMissing packages: {', '.join(missing)}")
        print("Install with: pip install " + " ".join(missing))
        return False
    else:
        print("\nAll dependencies available!")
        return True

if __name__ == '__main__':
    main()