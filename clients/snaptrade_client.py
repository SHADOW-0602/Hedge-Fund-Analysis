import requests
import pandas as pd
from typing import List, Dict, Optional
from utils.config import Config
from utils.logger import logger
from utils.user_secrets import user_secret_manager

try:
    from snaptrade_client import SnapTrade
    SNAPTRADE_SDK_AVAILABLE = True
except ImportError:
    SNAPTRADE_SDK_AVAILABLE = False

class SnapTradeClient:
    """SnapTrade API client for brokerage account integration"""
    
    def __init__(self):
        self.client_id = Config.SNAPTRADE_CLIENT_ID
        self.secret = Config.SNAPTRADE_SECRET
        self.api_key = Config.SNAPTRADE_API_KEY
        self.base_url = "https://api.snaptrade.com/api/v1"
        
        # Use official SDK if available
        if SNAPTRADE_SDK_AVAILABLE and self.client_id and self.secret:
            self.sdk = SnapTrade(
                client_id=self.client_id,
                consumer_key=self.secret
            )
        else:
            self.sdk = None
        
        # Fallback headers for direct API calls
        self.headers = {
            "Content-Type": "application/json",
            "clientId": self.client_id or "",
            "Signature": ""  # Will be set per request
        }
    
    def _get_signature(self, timestamp: str, path: str, body: str = ""):
        """Generate SnapTrade signature"""
        import hashlib
        import hmac
        import json
        
        # SnapTrade signature format: timestamp + path + body (JSON string)
        if body and isinstance(body, dict):
            body = json.dumps(body, separators=(',', ':'))
        elif not body:
            body = ""
            
        string_to_sign = f"{timestamp}{path}{body}"
        
        signature = hmac.new(
            self.secret.encode(),
            string_to_sign.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def get_accounts(self, user_id: str) -> List[Dict]:
        """Get user's brokerage accounts"""
        # Check for demo mode in session state
        try:
            import streamlit as st
            if hasattr(st, 'session_state') and 'demo_holdings' in st.session_state:
                return st.session_state.get('snaptrade_accounts', [])
        except:
            pass
            
        if not self.client_id or not self.secret:
            logger.error("SnapTrade credentials not configured")
            return []
            
        if self.sdk:
            try:
                user_secret = user_secret_manager.get_snaptrade_secret(user_id)
                if not user_secret:
                    logger.error(f"No user secret found for user_id: {user_id}")
                    # Try to create user first
                    if self.create_user(user_id):
                        user_secret = user_secret_manager.get_snaptrade_secret(user_id)
                    else:
                        return []
                
                logger.info(f"Attempting to get accounts for user_id: {user_id}")
                response = self.sdk.account_information.list_user_accounts(
                    user_id=user_id,
                    user_secret=user_secret
                )
                
                # Handle different response formats
                if hasattr(response, 'body'):
                    accounts = response.body
                else:
                    accounts = response
                    
                return accounts if isinstance(accounts, list) else []
            except Exception as e:
                logger.error(f"SnapTrade accounts error: {e}")
                return []
        return []
    
    def get_holdings(self, user_id: str, account_id: str = None) -> pd.DataFrame:
        """Get portfolio holdings from SnapTrade"""
        if self.sdk:
            try:
                user_secret = user_secret_manager.get_snaptrade_secret(user_id)
                if not user_secret:
                    return pd.DataFrame()
                
                if account_id:
                    response = self.sdk.account_information.get_user_holdings(
                        user_id=user_id,
                        user_secret=user_secret,
                        account_id=account_id
                    )
                else:
                    accounts = self.get_accounts(user_id)
                    if not accounts:
                        return pd.DataFrame()
                    
                    all_holdings = []
                    for account in accounts:
                        holdings = self.sdk.account_information.get_user_holdings(
                            user_id=user_id,
                            user_secret=user_secret,
                            account_id=account['id']
                        )
                        all_holdings.extend(holdings)
                    response = all_holdings
                
                holdings_data = []
                for holding in response:
                    symbol = holding.get('symbol', {}).get('symbol', 'N/A')
                    quantity = holding.get('units', 0)
                    price = holding.get('price', 0)
                    market_value = holding.get('market_value', 0)
                    
                    holdings_data.append({
                        'symbol': symbol,
                        'quantity': quantity,
                        'avg_cost': price,
                        'market_value': market_value,
                        'account_id': holding.get('account', {}).get('id', '')
                    })
                
                return pd.DataFrame(holdings_data)
            except Exception as e:
                logger.error(f"SnapTrade holdings error: {e}")
                return pd.DataFrame()
        return pd.DataFrame()
    
    def get_transactions(self, user_id: str, account_id: str = None, days: int = 30) -> pd.DataFrame:
        """Get transaction history"""
        if not self.api_key:
            return pd.DataFrame()
        
        try:
            url = f"{self.base_url}/activities"
            params = {
                "userId": user_id,
                "type": "TRADE"
            }
            if account_id:
                params["accountId"] = account_id
            
            response = requests.get(url, headers=self.headers, params=params)
            if response.status_code == 200:
                transactions = response.json()
                
                transaction_data = []
                for txn in transactions:
                    symbol = txn.get('symbol', {}).get('symbol', 'N/A')
                    action = txn.get('type', '').upper()
                    quantity = txn.get('units', 0)
                    price = txn.get('price', 0)
                    date = txn.get('trade_date', '')
                    
                    transaction_data.append({
                        'date': date,
                        'ticker': symbol,
                        'action': action,
                        'shares': quantity,
                        'price': price,
                        'commission': txn.get('fee', 0)
                    })
                
                return pd.DataFrame(transaction_data)
            else:
                logger.error(f"SnapTrade transactions error: {response.status_code}")
                return pd.DataFrame()
                
        except Exception as e:
            logger.error(f"SnapTrade transactions error: {e}")
            return pd.DataFrame()
    
    def get_brokerages(self) -> List[Dict]:
        """Get list of supported brokerages"""
        if not self.api_key:
            return []
        
        try:
            url = f"{self.base_url}/brokerages"
            
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"SnapTrade brokerages error: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"SnapTrade brokerages error: {e}")
            return []
    
    def create_user(self, user_id: str) -> bool:
        """Register a new user with SnapTrade"""
        if not self.client_id or not self.secret:
            logger.error("SnapTrade credentials not configured")
            return False
            
        if self.sdk:
            try:
                # Generate initial user secret (SnapTrade will return the real one)
                temp_user_secret = user_secret_manager.generate_user_secret(user_id, self.secret)
                logger.info(f"Creating SnapTrade user: {user_id}")
                
                response = self.sdk.authentication.register_snap_trade_user(
                    body={"userId": user_id, "userSecret": temp_user_secret}
                )
                
                # Extract the ACTUAL userSecret from SnapTrade's response
                if hasattr(response, 'body') and 'userSecret' in response.body:
                    actual_user_secret = response.body['userSecret']
                    # Store the actual userSecret returned by SnapTrade
                    user_secret_manager.store_user_secret(user_id, actual_user_secret)
                    logger.info(f"SnapTrade user creation successful for: {user_id}")
                    return True
                else:
                    logger.error(f"SnapTrade response missing userSecret: {response}")
                    return False
                    
            except Exception as e:
                error_msg = str(e)
                if "already exist" in error_msg:
                    logger.info(f"SnapTrade user {user_id} already exists")
                    return True  # User exists, that's fine
                else:
                    logger.error(f"SnapTrade SDK user creation error: {e}")
                    return False
        
        # Fallback to manual implementation
        return False
    
    def get_brokerages(self) -> List[Dict]:
        """Get list of supported brokerages - this works"""
        if not self.api_key:
            return []
        
        try:
            url = f"{self.base_url}/brokerages"
            response = requests.get(url, headers=self.headers)
            if response.status_code == 200:
                return response.json()
            return []
        except:
            return []
    
    def get_redirect_uri(self, user_id: str, brokerage_id: str = None) -> str:
        """Generate SnapTrade redirect URI for brokerage connection"""
        if self.sdk:
            try:
                # Get stored user secret
                user_secret = user_secret_manager.get_snaptrade_secret(user_id)
                if not user_secret:
                    logger.error(f"No user secret found for {user_id}")
                    return ''
                
                response = self.sdk.authentication.login_snap_trade_user(
                    user_id=user_id,
                    user_secret=user_secret,
                    broker=brokerage_id
                )
                return response.get('redirectURI', '')
            except Exception as e:
                logger.error(f"SnapTrade redirect URI error: {e}")
                return ''
        return ''

# Global instance
snaptrade_client = SnapTradeClient() if Config.SNAPTRADE_API_KEY else None