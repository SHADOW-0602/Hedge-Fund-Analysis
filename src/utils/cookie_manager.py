import streamlit as st
import json
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class CookieManager:
    def __init__(self):
        self.cookie_prefix = "hedge_fund_"
        self.max_age = 30 * 24 * 3600  # 30 days in seconds
    
    def set_user_preferences(self, user_id: str, preferences: Dict[str, Any]):
        """Save user preferences to cookies"""
        try:
            cookie_name = f"{self.cookie_prefix}prefs_{user_id}"
            cookie_value = json.dumps(preferences)
            
            # Use Streamlit's experimental cookie setter
            if hasattr(st, 'experimental_set_query_params'):
                # Store in session state as fallback
                st.session_state[cookie_name] = preferences
            
            # Also store in browser localStorage via JavaScript
            js_code = f"""
            <script>
                localStorage.setItem('{cookie_name}', '{cookie_value}');
            </script>
            """
            st.components.v1.html(js_code, height=0)
            
        except Exception as e:
            print(f"Error setting preferences: {e}")
    
    def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user preferences from cookies"""
        try:
            cookie_name = f"{self.cookie_prefix}prefs_{user_id}"
            
            # Try session state first
            if cookie_name in st.session_state:
                return st.session_state[cookie_name]
            
            # Default preferences
            return {
                "theme": "light",
                "default_period": "1y",
                "auto_refresh": True,
                "show_news": True,
                "chart_type": "line"
            }
            
        except Exception as e:
            print(f"Error getting preferences: {e}")
            return {}
    
    def set_portfolio_history(self, user_id: str, portfolio_list: list):
        """Save recent portfolio history"""
        try:
            # Keep only last 5 portfolios
            recent_portfolios = portfolio_list[-5:] if len(portfolio_list) > 5 else portfolio_list
            
            cookie_name = f"{self.cookie_prefix}history_{user_id}"
            st.session_state[cookie_name] = recent_portfolios
            
        except Exception as e:
            print(f"Error setting portfolio history: {e}")
    
    def get_portfolio_history(self, user_id: str) -> list:
        """Get recent portfolio history"""
        try:
            cookie_name = f"{self.cookie_prefix}history_{user_id}"
            return st.session_state.get(cookie_name, [])
        except:
            return []
    
    def set_last_login(self, user_id: str):
        """Record last login time"""
        try:
            cookie_name = f"{self.cookie_prefix}last_login_{user_id}"
            login_time = datetime.now().isoformat()
            st.session_state[cookie_name] = login_time
        except:
            pass
    
    def get_last_login(self, user_id: str) -> Optional[str]:
        """Get last login time"""
        try:
            cookie_name = f"{self.cookie_prefix}last_login_{user_id}"
            return st.session_state.get(cookie_name)
        except:
            return None
    
    def set_dashboard_layout(self, user_id: str, layout_config: Dict[str, Any]):
        """Save dashboard layout preferences"""
        try:
            cookie_name = f"{self.cookie_prefix}layout_{user_id}"
            st.session_state[cookie_name] = layout_config
        except:
            pass
    
    def get_dashboard_layout(self, user_id: str) -> Dict[str, Any]:
        """Get dashboard layout preferences"""
        try:
            cookie_name = f"{self.cookie_prefix}layout_{user_id}"
            return st.session_state.get(cookie_name, {
                "show_correlation_matrix": True,
                "show_sector_allocation": True,
                "show_risk_metrics": True,
                "show_news_feed": True,
                "chart_height": 400
            })
        except:
            return {}
    
    def clear_user_cookies(self, user_id: str):
        """Clear all cookies for a user"""
        try:
            keys_to_remove = []
            for key in st.session_state.keys():
                if key.startswith(f"{self.cookie_prefix}") and user_id in key:
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                del st.session_state[key]
                
        except Exception as e:
            print(f"Error clearing cookies: {e}")
    
    def get_cookie_stats(self, user_id: str) -> Dict[str, Any]:
        """Get cookie usage statistics"""
        try:
            user_cookies = {}
            for key, value in st.session_state.items():
                if key.startswith(f"{self.cookie_prefix}") and user_id in key:
                    user_cookies[key] = len(str(value))
            
            return {
                "total_cookies": len(user_cookies),
                "total_size_bytes": sum(user_cookies.values()),
                "cookies": user_cookies
            }
        except:
            return {"total_cookies": 0, "total_size_bytes": 0}

# Global cookie manager
cookie_manager = CookieManager()