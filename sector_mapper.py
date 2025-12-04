import pandas as pd
import json
import os

class SectorMapper:
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
        
        # Try yfinance lookup as last resort
        try:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info
            sector = info.get('sector', 'Unknown')
            if sector and sector != 'Unknown':
                print(f"Found {symbol} via yfinance: {sector}")
                # Cache the result
                self.sector_data[symbol] = sector
                return sector
        except Exception:
            pass
        
        print(f"UNKNOWN SYMBOL: '{symbol}' (len:{len(symbol)}) - not found anywhere")
        # Show first few Excel symbols for comparison
        sample_excel = list(self.sector_data.keys())[:5] if self.sector_data else []
        print(f"  Excel sample: {sample_excel}")
        return 'Unknown'
    
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