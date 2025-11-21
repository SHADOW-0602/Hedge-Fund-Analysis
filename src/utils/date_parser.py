from datetime import datetime, timedelta
import re
from dateutil import parser as dateutil_parser

class UniversalDateParser:
    """Universal date parser for all brokerage formats"""
    
    @staticmethod
    def parse_date(date_input):
        """Parse any date format from major brokerages"""
        if not date_input:
            return datetime.now()
        
        if isinstance(date_input, datetime):
            return date_input
        
        date_str = str(date_input).strip()
        if not date_str:
            return datetime.now()
        
        # Try dateutil parser first (handles most formats)
        try:
            return dateutil_parser.parse(date_str)
        except:
            pass
        
        # Fallback patterns for specific brokerage formats
        patterns = [
            # ISO formats
            r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)',
            r'(\d{4}-\d{2}-\d{2})',
            # US formats (MM/DD/YYYY, M/D/YYYY)
            r'(\d{1,2}/\d{1,2}/\d{4})',
            # Timestamp formats
            r'(\d{10,13})',  # Unix timestamp
            # Excel serial date
            r'(\d{5})',  # Excel date serial
        ]
        
        for pattern in patterns:
            match = re.search(pattern, date_str)
            if match:
                try:
                    matched_date = match.group(1)
                    
                    # Handle Unix timestamp
                    if matched_date.isdigit() and len(matched_date) >= 10:
                        timestamp = int(matched_date)
                        if len(matched_date) == 13:  # milliseconds
                            timestamp = timestamp / 1000
                        return datetime.fromtimestamp(timestamp)
                    
                    # Handle Excel serial date
                    if matched_date.isdigit() and len(matched_date) == 5:
                        excel_date = int(matched_date)
                        return datetime(1900, 1, 1) + timedelta(days=excel_date - 2)
                    
                    # Try parsing the matched string
                    return dateutil_parser.parse(matched_date)
                except:
                    continue
        
        # Last resort: return current time
        return datetime.now()