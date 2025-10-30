import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime
import io

class PortseidoClient:
    def __init__(self):
        self.template_url = "https://www.portseido.com/template"
    
    def parse_portseido_excel(self, file_content) -> Optional[pd.DataFrame]:
        """Parse Portseido Excel template format"""
        try:
            # Read Excel file
            df = pd.read_excel(file_content)
            
            # Expected Portseido columns (adjust based on actual template)
            expected_columns = ['Symbol', 'Quantity', 'Price', 'Date', 'Action']
            
            # Check if it's a Portseido format
            if any(col in df.columns for col in expected_columns):
                # Convert to standard portfolio format
                portfolio_data = []
                
                for _, row in df.iterrows():
                    if pd.notna(row.get('Symbol')) and pd.notna(row.get('Quantity')):
                        portfolio_data.append({
                            'symbol': str(row.get('Symbol', '')).upper(),
                            'quantity': float(row.get('Quantity', 0)),
                            'avg_cost': float(row.get('Price', 0)),
                            'date': row.get('Date', datetime.now()),
                            'action': row.get('Action', 'BUY')
                        })
                
                return pd.DataFrame(portfolio_data) if portfolio_data else None
            
            return None
            
        except Exception as e:
            print(f"Error parsing Portseido Excel: {e}")
            return None
    
    def generate_portseido_template(self) -> bytes:
        """Generate a Portseido-compatible Excel template"""
        template_data = {
            'Symbol': ['AAPL', 'MSFT', 'GOOGL'],
            'Quantity': [100, 50, 25],
            'Price': [150.00, 250.00, 2500.00],
            'Date': [datetime.now().strftime('%Y-%m-%d')] * 3,
            'Action': ['BUY', 'BUY', 'BUY']
        }
        
        df = pd.DataFrame(template_data)
        
        # Convert to Excel bytes
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Portfolio', index=False)
        
        return output.getvalue()
    
    def get_portfolio_summary(self, df: pd.DataFrame) -> Dict:
        """Generate portfolio summary from Portseido data"""
        if df is None or df.empty:
            return {}
        
        try:
            summary = {
                'total_positions': len(df),
                'total_value': (df['quantity'] * df['avg_cost']).sum(),
                'symbols': df['symbol'].tolist(),
                'largest_position': df.loc[df['quantity'] * df['avg_cost'] == (df['quantity'] * df['avg_cost']).max(), 'symbol'].iloc[0],
                'portfolio_date': datetime.now().strftime('%Y-%m-%d')
            }
            
            return summary
            
        except Exception as e:
            print(f"Error generating summary: {e}")
            return {}

# Global instance
portseido_client = PortseidoClient()