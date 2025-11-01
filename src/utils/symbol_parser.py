import re
from typing import Dict, Optional

def parse_options_symbol(symbol: str) -> Optional[Dict]:
    """Parse options symbol like ACHR260116C00011000"""
    # Pattern: TICKER + YYMMDD + C/P + STRIKE (8 digits)
    pattern = r'^([A-Z]{1,6})(\d{6})([CP])(\d{8})$'
    match = re.match(pattern, symbol)
    
    if not match:
        return None
    
    ticker, date_str, option_type, strike_str = match.groups()
    
    # Parse date (YYMMDD)
    year = 2000 + int(date_str[:2])
    month = int(date_str[2:4])
    day = int(date_str[4:6])
    
    # Parse strike (8 digits, last 3 are decimals)
    strike = int(strike_str) / 1000
    
    return {
        'underlying': ticker,
        'expiry_date': f"{year}-{month:02d}-{day:02d}",
        'option_type': 'call' if option_type == 'C' else 'put',
        'strike': strike,
        'is_option': True
    }

def get_underlying_symbol(symbol: str) -> str:
    """Extract underlying symbol from options or return original"""
    parsed = parse_options_symbol(symbol)
    return parsed['underlying'] if parsed else symbol

def filter_symbols_for_analysis(symbols: list) -> Dict:
    """Separate stocks from options for different analysis"""
    stocks = []
    options = []
    
    for symbol in symbols:
        if parse_options_symbol(symbol):
            options.append(symbol)
        else:
            stocks.append(symbol)
    
    return {'stocks': stocks, 'options': options}