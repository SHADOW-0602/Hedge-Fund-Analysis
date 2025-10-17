import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

class FinancialStatementAnalyzer:
    def __init__(self):
        self.cache = {}
    
    def get_financial_statements(self, symbol: str) -> Dict:
        """Get comprehensive financial statements for a symbol"""
        if symbol in self.cache:
            return self.cache[symbol]
        
        try:
            ticker = yf.Ticker(symbol)
            
            # Get financial statements
            income_stmt = ticker.financials
            balance_sheet = ticker.balance_sheet
            cash_flow = ticker.cashflow
            
            # Get market data
            info = ticker.info
            market_cap = info.get('marketCap', 0)
            
            # Process statements
            financial_data = {
                'symbol': symbol,
                'market_cap': market_cap,
                'income_statement': self._process_income_statement(income_stmt),
                'balance_sheet': self._process_balance_sheet(balance_sheet),
                'cash_flow': self._process_cash_flow(cash_flow),
                'ratios': self._calculate_ratios(income_stmt, balance_sheet, market_cap),
                'last_updated': pd.Timestamp.now()
            }
            
            self.cache[symbol] = financial_data
            return financial_data
            
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return {}
    
    def _process_income_statement(self, income_stmt: pd.DataFrame) -> Dict:
        """Process income statement data"""
        if income_stmt.empty:
            return {}
        
        latest = income_stmt.iloc[:, 0]  # Most recent year
        
        return {
            'revenue': latest.get('Total Revenue', 0),
            'gross_profit': latest.get('Gross Profit', 0),
            'operating_income': latest.get('Operating Income', 0),
            'net_income': latest.get('Net Income', 0),
            'ebitda': latest.get('EBITDA', 0),
            'eps': latest.get('Basic EPS', 0),
            'shares_outstanding': latest.get('Basic Average Shares', 0)
        }
    
    def _process_balance_sheet(self, balance_sheet: pd.DataFrame) -> Dict:
        """Process balance sheet data"""
        if balance_sheet.empty:
            return {}
        
        latest = balance_sheet.iloc[:, 0]  # Most recent quarter
        
        return {
            'total_assets': latest.get('Total Assets', 0),
            'total_liabilities': latest.get('Total Liab', 0),
            'shareholders_equity': latest.get('Total Stockholder Equity', 0),
            'cash': latest.get('Cash', 0),
            'total_debt': latest.get('Total Debt', 0),
            'current_assets': latest.get('Total Current Assets', 0),
            'current_liabilities': latest.get('Total Current Liabilities', 0)
        }
    
    def _process_cash_flow(self, cash_flow: pd.DataFrame) -> Dict:
        """Process cash flow statement data"""
        if cash_flow.empty:
            return {}
        
        latest = cash_flow.iloc[:, 0]  # Most recent year
        
        return {
            'operating_cash_flow': latest.get('Total Cash From Operating Activities', 0),
            'investing_cash_flow': latest.get('Total Cashflows From Investing Activities', 0),
            'financing_cash_flow': latest.get('Total Cash From Financing Activities', 0),
            'free_cash_flow': latest.get('Free Cash Flow', 0),
            'capex': latest.get('Capital Expenditures', 0)
        }
    
    def _calculate_ratios(self, income_stmt: pd.DataFrame, balance_sheet: pd.DataFrame, market_cap: float) -> Dict:
        """Calculate key financial ratios"""
        ratios = {}
        
        if not income_stmt.empty and not balance_sheet.empty:
            income_latest = income_stmt.iloc[:, 0]
            balance_latest = balance_sheet.iloc[:, 0]
            
            revenue = income_latest.get('Total Revenue', 0)
            net_income = income_latest.get('Net Income', 0)
            total_assets = balance_latest.get('Total Assets', 0)
            shareholders_equity = balance_latest.get('Total Stockholder Equity', 0)
            total_debt = balance_latest.get('Total Debt', 0)
            current_assets = balance_latest.get('Total Current Assets', 0)
            current_liabilities = balance_latest.get('Total Current Liabilities', 0)
            
            # Profitability ratios
            ratios['roe'] = net_income / shareholders_equity if shareholders_equity != 0 else 0
            ratios['roa'] = net_income / total_assets if total_assets != 0 else 0
            ratios['net_margin'] = net_income / revenue if revenue != 0 else 0
            
            # Liquidity ratios
            ratios['current_ratio'] = current_assets / current_liabilities if current_liabilities != 0 else 0
            
            # Leverage ratios
            ratios['debt_to_equity'] = total_debt / shareholders_equity if shareholders_equity != 0 else 0
            
            # Valuation ratios
            ratios['price_to_book'] = market_cap / shareholders_equity if shareholders_equity != 0 else 0
            
        return ratios
    
    def multi_ticker_analysis(self, symbols: List[str], max_workers: int = 5) -> Dict:
        """Concurrent analysis of multiple tickers"""
        results = {}
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_symbol = {
                executor.submit(self.get_financial_statements, symbol): symbol 
                for symbol in symbols
            }
            
            # Collect results
            for future in as_completed(future_to_symbol):
                symbol = future_to_symbol[future]
                try:
                    result = future.result()
                    if result:
                        results[symbol] = result
                except Exception as e:
                    print(f"Error processing {symbol}: {e}")
                
                # Rate limiting
                time.sleep(0.1)
        
        return results
    
    def comparative_analysis(self, symbols: List[str]) -> pd.DataFrame:
        """Create comparative analysis DataFrame"""
        data = self.multi_ticker_analysis(symbols)
        
        comparison_data = []
        for symbol, financial_data in data.items():
            if not financial_data:
                continue
            
            row = {
                'Symbol': symbol,
                'Market Cap': financial_data.get('market_cap', 0),
                'Revenue': financial_data.get('income_statement', {}).get('revenue', 0),
                'Net Income': financial_data.get('income_statement', {}).get('net_income', 0),
                'ROE': financial_data.get('ratios', {}).get('roe', 0),
                'ROA': financial_data.get('ratios', {}).get('roa', 0),
                'Current Ratio': financial_data.get('ratios', {}).get('current_ratio', 0),
                'Debt/Equity': financial_data.get('ratios', {}).get('debt_to_equity', 0),
                'P/B Ratio': financial_data.get('ratios', {}).get('price_to_book', 0)
            }
            comparison_data.append(row)
        
        df = pd.DataFrame(comparison_data)
        
        # Add rankings
        if not df.empty:
            df['ROE_Rank'] = df['ROE'].rank(ascending=False)
            df['Revenue_Rank'] = df['Revenue'].rank(ascending=False)
            df['Market_Cap_Rank'] = df['Market Cap'].rank(ascending=False)
        
        return df
    
    def export_to_csv(self, symbols: List[str], filename: str = 'financial_analysis.csv'):
        """Export analysis to CSV"""
        df = self.comparative_analysis(symbols)
        df.to_csv(filename, index=False)
        print(f"Analysis exported to {filename}")
        return df

# Example usage
if __name__ == "__main__":
    analyzer = FinancialStatementAnalyzer()
    
    # Analyze multiple stocks
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
    
    print("Fetching financial data...")
    comparison_df = analyzer.comparative_analysis(symbols)
    
    print("\nComparative Analysis:")
    print(comparison_df.to_string(index=False))
    
    # Export to CSV
    analyzer.export_to_csv(symbols)