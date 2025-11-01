#!/usr/bin/env python3
"""Apply symbol parser to all analysis endpoints"""

import re

def apply_symbol_parser_to_file():
    with open('src/api/portfolio_routes.py', 'r') as f:
        content = f.read()
    
    # Add import at top
    if 'from utils.symbol_parser import get_underlying_symbol' not in content:
        content = content.replace(
            'from utils.fed_rate import get_risk_free_rate',
            'from utils.fed_rate import get_risk_free_rate\nfrom utils.symbol_parser import get_underlying_symbol'
        )
    
    # Apply to monte-carlo endpoint
    content = re.sub(
        r'(\s+)# Filter valid symbols\n(\s+)filtered_portfolio_data = \[\]\n(\s+)for position in portfolio_data:\n(\s+)symbol = position\.get\(\'symbol\', \'\'\)\.strip\(\)\n(\s+)if \(symbol and not symbol\.startswith\(\'CUR:\'\) and \n(\s+)not symbol\.startswith\(\'CASH\'\) and len\(symbol\) <= 10\):\n(\s+)filtered_portfolio_data\.append\(position\)',
        r'\1# Filter valid symbols\n\2filtered_portfolio_data = []\n\3for position in portfolio_data:\n\4symbol = position.get(\'symbol\', \'\').strip()\n\5if symbol and not symbol.startswith(\'CUR:\') and not symbol.startswith(\'CASH\'):\n\6underlying = get_underlying_symbol(symbol)\n\7if underlying and len(underlying) <= 10:\n\8new_position = position.copy()\n\9new_position[\'symbol\'] = underlying\n\10filtered_portfolio_data.append(new_position)',
        content
    )
    
    # Apply to other endpoints with similar patterns
    patterns = [
        (r'symbols = \[p\.get\(\'symbol\'\) for p in portfolio if p\.get\(\'symbol\'\) and not p\.get\(\'symbol\'\)\.startswith\(\'CUR:\'\)\]\[:10\]',
         'symbols = [get_underlying_symbol(p.get(\'symbol\')) for p in portfolio if p.get(\'symbol\') and not p.get(\'symbol\').startswith(\'CUR:\') and get_underlying_symbol(p.get(\'symbol\'))][:10]'),
        
        (r'symbols = \[p\.get\(\'symbol\'\) for p in portfolio if p\.get\(\'symbol\'\) and not p\.get\(\'symbol\'\)\.startswith\(\'CUR:\'\)\]\[:15\]',
         'symbols = [get_underlying_symbol(p.get(\'symbol\')) for p in portfolio if p.get(\'symbol\') and not p.get(\'symbol\').startswith(\'CUR:\') and get_underlying_symbol(p.get(\'symbol\'))][:15]'),
        
        (r'symbols = \[p\.get\(\'symbol\'\) for p in portfolio_data\]',
         'symbols = [get_underlying_symbol(p.get(\'symbol\')) for p in portfolio_data if get_underlying_symbol(p.get(\'symbol\'))]'),
        
        (r'valid_symbols = \[s for s in symbols if s and not s\.startswith\(\'CUR:\'\) and not s\.startswith\(\'CASH\'\) and len\(s\) <= 10\]',
         'valid_symbols = [get_underlying_symbol(s) for s in symbols if s and not s.startswith(\'CUR:\') and not s.startswith(\'CASH\') and get_underlying_symbol(s) and len(get_underlying_symbol(s)) <= 10]')
    ]
    
    for old, new in patterns:
        content = re.sub(old, new, content)
    
    with open('src/api/portfolio_routes.py', 'w') as f:
        f.write(content)
    
    print("Applied symbol parser to all endpoints")

if __name__ == "__main__":
    apply_symbol_parser_to_file()