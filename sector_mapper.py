import pandas as pd
import json
import os

class SectorMapper:
    # Approximate SPY Sector Weights (as of late 2024)
    SPY_SECTOR_WEIGHTS = {
        'Information Technology': 31.0,
        'Financials': 13.0,
        'Health Care': 12.0,
        'Consumer Discretionary': 10.0,
        'Communication Services': 9.0,
        'Industrials': 8.5,
        'Consumer Staples': 6.0,
        'Energy': 3.5,
        'Utilities': 2.5,
        'Real Estate': 2.5,
        'Materials': 2.0,
        'Technology': 31.0, # Map variations
        'Healthcare': 12.0,
        'Financial Services': 13.0,
        'Basic Materials': 2.0
    }

    # Normalize sector names to GICS standards for comparison
    SECTOR_NORMALIZATION = {
        'TECHNOLOGY': 'Information Technology',
        'TECH': 'Information Technology',
        'CONSUMER CYCLICAL': 'Consumer Discretionary',
        'CONSUMER DEFENSIVE': 'Consumer Staples',
        'FINANCIAL': 'Financials',
        'FINANCIAL SERVICES': 'Financials',
        'HEALTHCARE': 'Health Care',
        'BASIC MATERIALS': 'Materials',
        'SERVICES': 'Communication Services', # Often overlaps
    }

    def __init__(self, xlsx_path=None):
        if xlsx_path is None:
            # Get the absolute path to the Excel file
            current_dir = os.path.dirname(os.path.abspath(__file__))
            self.xlsx_path = os.path.join(current_dir, "US Stocks_Basic Data.xlsx")
        else:
            self.xlsx_path = xlsx_path
        self.sector_data = {}
        self.industry_data = {}
        self.country_data = {}
        self._load_data()
    
    def _load_data(self):
        """Load sector data from xlsx file"""
        try:
            print(f"Loading Excel file from: {self.xlsx_path}")
            if not os.path.exists(self.xlsx_path):
                print(f"Error: File not found at {self.xlsx_path}")
                return

            df = pd.read_excel(self.xlsx_path)
            print(f"Excel file loaded successfully, shape: {df.shape}")
            print(f"Columns: {list(df.columns)}")
            
            # Reset data containers
            self.sector_data = {}
            self.industry_data = {}
            self.country_data = {}
            
            df = df.drop_duplicates(subset=['Ticker'])
            
            for _, row in df.iterrows():
                ticker = str(row.get('Ticker', '')).upper().strip()
                sector = str(row.get('Sector', 'Unknown')).strip()
                industry = str(row.get('Industry', 'Unknown')).strip()
                country = str(row.get('Country', 'US')).strip()
                
                # Filter out invalid tickers
                if (ticker and ticker != 'NAN' and len(ticker) <= 6 and 
                    not ticker.startswith('TEST') and ticker.replace('.', '').replace('-', '').isalnum()):
                    self.sector_data[ticker] = sector
                    self.industry_data[ticker] = industry
                    self.country_data[ticker] = country
            
            print(f"Loaded {len(self.sector_data)} symbols from Excel file")
            # Debug: Show first few entries
            sample_symbols = list(self.sector_data.keys())[:5]
            for symbol in sample_symbols:
                print(f"  {symbol}: {self.sector_data[symbol]}")
                
        except Exception as e:
            print(f"Error loading sector data: {e}")
            import traceback
            traceback.print_exc()
            print("Excel file not found or invalid - sector analysis will use Unknown for all symbols")

    def reload_data(self):
        """Reload data from the Excel file"""
        print("Reloading sector data...")
        self._load_data()
        return {
            'success': True,
            'count': len(self.sector_data),
            'sectors': self.get_all_sectors()
        }

    def update_data_file(self, new_file_path):
        """Update the data file path and reload"""
        if os.path.exists(new_file_path):
            self.xlsx_path = new_file_path
            return self.reload_data()
        else:
            raise FileNotFoundError(f"File not found: {new_file_path}")
    
    def get_sector(self, symbol):
        """Get sector for a given symbol"""
        symbol = symbol.upper().strip()
        
        # Direct lookup first
        if symbol in self.sector_data:
            return self.sector_data[symbol]
        
        # Try common symbol variations
        variations = [
            symbol.replace('.', ''),  # Remove dots
            symbol.replace('-', ''),  # Remove dashes
            symbol.split('.')[0],     # Take part before dot
            symbol.split('-')[0]      # Take part before dash
        ]
        
        for variation in variations:
            if variation != symbol and variation in self.sector_data:
                print(f"Found {symbol} as variation {variation}: {self.sector_data[variation]}")
                return self.sector_data[variation]
        
        # Handle ETFs and special cases
        etf_mapping = {
            'SPY': 'Broad Market ETF',
            'IWV': 'Broad Market ETF', 
            'URTH': 'International ETF',
            'QQQ': 'Technology ETF',
            'XLK': 'Technology ETF',
            'XLF': 'Financial ETF',
            'XLE': 'Energy ETF',
            'XLV': 'Healthcare ETF',
            'VTI': 'Broad Market ETF',
            'VOO': 'Broad Market ETF',
            'IWM': 'Small Cap ETF'
        }
        
        if symbol in etf_mapping:
            print(f"Found {symbol} in ETF mapping: {etf_mapping[symbol]}")
            return etf_mapping[symbol]
        
        # Try yfinance lookup
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info
            sector = info.get('sector', 'Unknown')
            if sector and sector != 'Unknown':
                print(f"Found {symbol} via yfinance: {sector}")
                # Cache the result
                self.sector_data[symbol] = sector
                
                # Also cache industry/country if available
                industry = info.get('industry', 'Unknown')
                country = info.get('country', 'US')
                
                if industry != 'Unknown':
                    self.industry_data[symbol] = industry
                if country != 'US':
                    self.country_data[symbol] = country
                    
                return sector
        except Exception:
            pass

        # === GROQ API FALLBACK ===
        try:
            print(f"Attempting Groq AI lookup for {symbol}...")
            groq_data = self.get_sector_from_groq(symbol)
            if groq_data:
                sector = groq_data.get('sector', 'Unknown')
                if sector and sector != 'Unknown':
                    print(f"Found {symbol} via Groq AI: {sector}")
                    
                    # Cache the results
                    self.sector_data[symbol] = sector
                    self.industry_data[symbol] = groq_data.get('industry', 'Unknown')
                    self.country_data[symbol] = groq_data.get('country', 'US')
                    
                    return sector
        except Exception as e:
            print(f"Groq lookup failed for {symbol}: {e}")
        
        print(f"UNKNOWN SYMBOL: '{symbol}' (len:{len(symbol)}) - not found anywhere")
        # Show first few Excel symbols for comparison
        sample_excel = list(self.sector_data.keys())[:5] if self.sector_data else []
        print(f"  Excel sample: {sample_excel}")
        return 'Unknown'
    
    def get_sector_from_groq(self, symbol):
        """Use Groq API to determine sector, industry, and country"""
        try:
            import requests
            api_key = os.getenv('GROQ_API_KEY')
            if not api_key:
                return None
                
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            
            prompt = f"""
            Analyze the financial instrument with ticker symbol '{symbol}'. 
            Return a JSON object with the following fields:
            - "sector": The GICS sector name (e.g., Technology, Healthcare, Financials).
            - "industry": The specific industry.
            - "country": The country code (2-letter, e.g., US, CN, DE) or full name.
            
            Example response: {{"sector": "Technology", "industry": "Consumer Electronics", "country": "US"}}
            Return ONLY the JSON object, no explanation. If unknown, return null values.
            """
            
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": "You are a specialized financial data assistant that outputs raw JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"}
            }
            
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                data = json.loads(content)
                return data
            else:
                print(f"Groq API Error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            print(f"Error calling Groq API: {e}")
            return None
    
    def get_benchmark_weights(self, benchmark='SPY'):
        """Get sector weights for a benchmark, trying API first then fallback"""
        # specialized ETF caching
        cache_file = os.path.join(os.path.dirname(self.xlsx_path), f"benchmark_{benchmark}.json")
        
        # 1. Try to load from local cache if recent (e.g., < 7 days old)
        if os.path.exists(cache_file):
            try:
                # Simple check: is file older than 7 days?
                file_time = os.path.getmtime(cache_file)
                import time
                if (time.time() - file_time) < (7 * 24 * 3600):
                    with open(cache_file, 'r') as f:
                        print(f"Loading cached benchmark data for {benchmark}")
                        return json.load(f)
            except Exception:
                pass

        # 2. Try Alpha Vantage API if key exists and not cached/stale
        api_key = os.getenv('ALPHAVANTAGE_API_KEY')
        if api_key:
            try:
                print(f"Fetching live benchmark data for {benchmark} from Alpha Vantage...")
                import requests
                url = f'https://www.alphavantage.co/query?function=ETF_PROFILE&symbol={benchmark}&apikey={api_key}'
                r = requests.get(url, timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    sectors = data.get('sectors', [])
                    if sectors:
                        # Convert list of dicts to simple dict {'Sector': weight}
                        weights = {}
                        for item in sectors:
                            # Clean up sector name
                            sec_name = item.get('sector', '').title().replace('And', '&')
                            # Alpha Vantage gives weights as strings "0.31" or percentages? 
                            # Based on output "0.107", it is decimal.
                            try:
                                weight = float(item.get('weight', 0)) * 100 # Convert to percentage (0-100)
                                weights[sec_name] = weight
                            except:
                                pass
                        
                        if weights:
                            # Save to cache
                            with open(cache_file, 'w') as f:
                                json.dump(weights, f)
                            return weights
            except Exception as e:
                print(f"Alpha Vantage API failed: {e}")

        # 3. Fallback to hardcoded SPY weights
        if benchmark == 'SPY':
            return self.SPY_SECTOR_WEIGHTS.copy()
            
        return {}

    def get_industry(self, symbol):
        """Get industry for a given symbol"""
        symbol = symbol.upper()
        if symbol in self.industry_data:
            return self.industry_data[symbol]
        
        # Fallback: Try to get industry from yfinance
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info
            industry = info.get('industry', 'Unknown')
            if industry and industry != 'Unknown':
                # Cache the result
                self.industry_data[symbol] = industry
                return industry
        except Exception:
            pass
        
        return 'Unknown'
    
    def get_country(self, symbol):
        """Get country for a given symbol"""
        symbol = symbol.upper()
        if symbol in self.country_data:
            return self.country_data[symbol]
        
        # Fallback: Try to get country from yfinance
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info
            country = info.get('country', 'US')
            if country and country != 'US':
                # Cache the result
                self.country_data[symbol] = country
                return country
        except Exception:
            pass
        
        return 'US'
    
    # Regex patterns for more robust matching
    SECTOR_REGEX_MAP = [
        (r'.*TECHNOLOGY.*', 'Information Technology'),
        (r'.*TECH.*', 'Information Technology'),
        (r'.*COMM.*SERVICE.*', 'Communication Services'),
        (r'.*CONSUMER.*CYCLICAL.*', 'Consumer Discretionary'),
        (r'.*DISCRETIONARY.*', 'Consumer Discretionary'),
        (r'.*CONSUMER.*DEFENSIVE.*', 'Consumer Staples'),
        (r'.*STAPLES.*', 'Consumer Staples'),
        (r'.*FINANCIAL.*', 'Financials'),
        (r'.*HEALTH.*', 'Health Care'),
        (r'.*MATERIAL.*', 'Materials'),
        (r'.*ESTATE.*', 'Real Estate'),
        (r'.*UTILIT.*', 'Utilities'),
        (r'.*ENERGY.*', 'Energy'),
        (r'.*INDUSTRI.*', 'Industrials')
    ]

    def normalize_sector_name(self, sector):
        """Normalize sector name to GICS standard using Regex"""
        if not sector:
            return 'Unknown'
        
        sector_upper = sector.upper().strip()
        
        # 1. Check direct mapping
        if sector_upper in self.SECTOR_NORMALIZATION:
            return self.SECTOR_NORMALIZATION[sector_upper]
            
        # 2. Check if it's already a standard key (case insensitive)
        for standard in self.SECTOR_NORMALIZATION.values():
            if sector_upper == standard.upper():
                return standard
        
        # 3. Check regex patterns
        import re
        for pattern, standard in self.SECTOR_REGEX_MAP:
            if re.match(pattern, sector_upper):
                print(f"Regex matched sector '{sector}' to '{standard}'")
                return standard
                
        return sector

    def get_all_sectors(self):
        """Get all unique sectors"""
        return list(set(self.sector_data.values()))
    
    def get_symbols_by_sector(self, sector):
        """Get all symbols in a specific sector"""
        return [symbol for symbol, sec in self.sector_data.items() if sec == sector]
    
    def analyze_portfolio_sectors(self, portfolio_data):
        """Analyze sector allocation for portfolio"""
        sector_allocation = {}
        industry_allocation = {}
        country_allocation = {}
        total_value = 0
        
        for position in portfolio_data:
            symbol = position.get('symbol', '').upper()
            value = position.get('market_value', 0) or position.get('quantity', 0) * position.get('price', 0)
            
            if value <= 0:
                continue
                
            sector = self.get_sector(symbol)
            industry = self.get_industry(symbol)
            country = self.get_country(symbol)
            
            # Sector allocation
            if sector not in sector_allocation:
                sector_allocation[sector] = {'value': 0, 'symbols': set()}
            sector_allocation[sector]['value'] += value
            sector_allocation[sector]['symbols'].add(symbol)
            
            # Industry allocation
            if industry not in industry_allocation:
                industry_allocation[industry] = {'value': 0, 'symbols': set()}
            industry_allocation[industry]['value'] += value
            industry_allocation[industry]['symbols'].add(symbol)
            
            # Country allocation
            if country not in country_allocation:
                country_allocation[country] = {'value': 0, 'symbols': set()}
            country_allocation[country]['value'] += value
            country_allocation[country]['symbols'].add(symbol)
            
            total_value += value
        
        # Calculate percentages and convert sets to lists
        for allocation in [sector_allocation, industry_allocation, country_allocation]:
            for key in allocation:
                allocation[key]['percentage'] = (allocation[key]['value'] / total_value * 100) if total_value > 0 else 0
                allocation[key]['symbols'] = list(allocation[key]['symbols'])
        
        return {
            'sectors': sector_allocation,
            'industries': industry_allocation,
            'countries': country_allocation,
            'total_value': total_value
        }

if __name__ == "__main__":
    # Test the sector mapper
    mapper = SectorMapper()
    print(f"Loaded {len(mapper.sector_data)} symbols")
    print(f"Available sectors: {mapper.get_all_sectors()}")
    
    # Test with sample symbols
    test_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'JPM']
    for symbol in test_symbols:
        print(f"{symbol}: Sector={mapper.get_sector(symbol)}, Industry={mapper.get_industry(symbol)}, Country={mapper.get_country(symbol)}")