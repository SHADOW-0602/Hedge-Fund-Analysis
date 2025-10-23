import requests
import pandas as pd
import uuid
from typing import List, Dict, Optional
from utils.config import Config
from utils.logger import logger
from utils.user_secrets import user_secret_manager
from utils.connection_retry import retry_manager, retry_on_connection_limit, create_zerodha_cleanup_func
import streamlit as st

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
        self.base_url = "https://api.snaptrade.com/api/v1"
        
        # Initialize SDK with credentials from .env
        if SNAPTRADE_SDK_AVAILABLE and self.client_id and self.secret:
            self.sdk = SnapTrade(
                client_id=self.client_id,
                consumer_key=self.secret
            )
        else:
            self.sdk = None
    
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
        """Get user's brokerage accounts with retry mechanism"""
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
            user_secret = user_secret_manager.get_snaptrade_secret(user_id)
            snaptrade_user_id = user_secret_manager.get_snaptrade_user_id(user_id)
            
            if not user_secret or not snaptrade_user_id:
                logger.error(f"Missing credentials for user_id: {user_id}")
                return []
            
            # Create cleanup function for connection limit handling
            cleanup_func = create_zerodha_cleanup_func(self, user_id)
            
            def _get_accounts_internal():
                logger.info(f"Getting accounts for SnapTrade user: {snaptrade_user_id}")
                response = self.sdk.account_information.list_user_accounts(
                    user_id=snaptrade_user_id,
                    user_secret=user_secret
                )
                
                logger.info(f"Accounts response: {response}")
                
                # Handle different response formats
                if hasattr(response, 'body'):
                    accounts = response.body
                else:
                    accounts = response
                
                accounts_list = accounts if isinstance(accounts, list) else []
                logger.info(f"Found {len(accounts_list)} accounts")
                return accounts_list
            
            try:
                return retry_manager.retry_with_backoff(
                    _get_accounts_internal,
                    max_retries=3,
                    connection_cleanup_func=cleanup_func
                )
            except Exception as e:
                error_msg = str(e)
                if "401" in error_msg or "Invalid userID or userSecret" in error_msg:
                    logger.warning(f"Invalid SnapTrade credentials for user {user_id}, clearing stored data")
                    # Clear invalid credentials
                    user_secret_manager.delete_snaptrade_secret(user_id)
                    user_secret_manager.delete_snaptrade_user_id(user_id)
                    # Clear session state if available
                    try:
                        if 'snaptrade_connected' in st.session_state:
                            st.session_state.snaptrade_connected = False
                        if 'snaptrade_accounts' in st.session_state:
                            del st.session_state.snaptrade_accounts
                    except:
                        pass
                    return []
                
                logger.error(f"SnapTrade accounts error after retries: {e}")
                import traceback
                logger.error(f"Full traceback: {traceback.format_exc()}")
                return []
        return []
    
    def get_holdings(self, user_id: str, account_id: str = None) -> pd.DataFrame:
        """Get portfolio holdings from SnapTrade"""
        if self.sdk:
            try:
                user_secret = user_secret_manager.get_snaptrade_secret(user_id)
                snaptrade_user_id = user_secret_manager.get_snaptrade_user_id(user_id)
                
                if not user_secret or not snaptrade_user_id:
                    return pd.DataFrame()
                
                if account_id:
                    response = self.sdk.account_information.get_user_holdings(
                        user_id=snaptrade_user_id,
                        user_secret=user_secret,
                        account_id=account_id
                    )
                    holdings = response.body if hasattr(response, 'body') else response
                else:
                    accounts = self.get_accounts(user_id)
                    if not accounts:
                        return pd.DataFrame()
                    
                    all_holdings = []
                    for account in accounts:
                        response = self.sdk.account_information.get_user_holdings(
                            user_id=snaptrade_user_id,
                            user_secret=user_secret,
                            account_id=account['id']
                        )
                        holdings = response.body if hasattr(response, 'body') else response
                        all_holdings.extend(holdings)
                    holdings = all_holdings
                
                holdings_data = []
                for holding in holdings:
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
        if not self.sdk:
            return pd.DataFrame()
        
        try:
            user_secret = user_secret_manager.get_snaptrade_secret(user_id)
            snaptrade_user_id = user_secret_manager.get_snaptrade_user_id(user_id)
            
            if not user_secret or not snaptrade_user_id:
                return pd.DataFrame()
            
            if account_id:
                response = self.sdk.transactions_and_reporting.get_activities(
                    user_id=snaptrade_user_id,
                    user_secret=user_secret,
                    account_id=account_id
                )
                activities = response.body if hasattr(response, 'body') else response
            else:
                accounts = self.get_accounts(user_id)
                if not accounts:
                    return pd.DataFrame()
                
                all_activities = []
                for account in accounts:
                    response = self.sdk.transactions_and_reporting.get_activities(
                        user_id=snaptrade_user_id,
                        user_secret=user_secret,
                        account_id=account['id']
                    )
                    activities = response.body if hasattr(response, 'body') else response
                    all_activities.extend(activities)
                activities = all_activities
            
            transaction_data = []
            for activity in activities:
                if activity.get('type') == 'TRADE':
                    symbol = activity.get('symbol', {}).get('symbol', 'N/A')
                    action = activity.get('action', '').upper()
                    quantity = activity.get('units', 0)
                    price = activity.get('price', 0)
                    date = activity.get('trade_date', '')
                    
                    transaction_data.append({
                        'date': date,
                        'ticker': symbol,
                        'action': action,
                        'shares': quantity,
                        'price': price,
                        'commission': activity.get('fee', 0)
                    })
            
            return pd.DataFrame(transaction_data)
                
        except Exception as e:
            logger.error(f"SnapTrade transactions error: {e}")
            return pd.DataFrame()
    
    def create_user(self, user_id: str) -> str:
        """Register a new user with SnapTrade. Returns status: 'success', 'exists', 'limit_reached', 'error'"""
        if not self.client_id or not self.secret:
            logger.error("SnapTrade credentials not configured")
            return 'error'
            
        if self.sdk:
            # Check if user already exists
            existing_secret = user_secret_manager.get_snaptrade_secret(user_id)
            existing_snaptrade_id = user_secret_manager.get_snaptrade_user_id(user_id)
            
            if existing_secret and existing_snaptrade_id:
                logger.info(f"SnapTrade user {user_id} already exists with ID {existing_snaptrade_id}")
                return 'exists'
            
            # Create cleanup function for connection limit handling
            cleanup_func = create_zerodha_cleanup_func(self, user_id)
            
            def _create_user_internal():
                logger.info(f"Creating SnapTrade user: {user_id}")
                
                # Use simple unique user ID
                unique_user_id = f"user_{uuid.uuid4().hex[:8]}"
                
                response = self.sdk.authentication.register_snap_trade_user(
                    body={'userId': unique_user_id}
                )
                
                logger.info(f"SnapTrade register response: {response}")
                
                # Extract userSecret from response
                if hasattr(response, 'body') and 'userSecret' in response.body:
                    user_secret = response.body['userSecret']
                    user_secret_manager.store_snaptrade_secret(user_id, user_secret)
                    user_secret_manager.store_snaptrade_user_id(user_id, unique_user_id)
                    logger.info(f"SnapTrade user creation successful: {user_id} -> {unique_user_id}")
                    return 'success'
                else:
                    logger.error(f"No userSecret in response: {response}")
                    raise Exception("No userSecret in response")
            
            try:
                return retry_manager.retry_with_backoff(
                    _create_user_internal,
                    max_retries=3,
                    connection_cleanup_func=cleanup_func
                )
            except Exception as e:
                error_msg = str(e)
                if "Connection Limit Reached" in error_msg or "maximum number of connections" in error_msg:
                    logger.error(f"SnapTrade connection limit reached after retries: {e}")
                    return 'limit_reached'
                elif "already exist" in error_msg:
                    logger.info(f"SnapTrade user already exists: {error_msg}")
                    return 'exists'
                else:
                    logger.error(f"SnapTrade user creation error: {e}")
                    return 'error'
        
        return 'error'
    
    def get_brokerages(self) -> List[Dict]:
        """Get list of supported brokerages"""
        if self.sdk:
            try:
                response = self.sdk.reference_data.list_all_brokerages()
                if hasattr(response, 'body'):
                    return response.body
                else:
                    return response
            except Exception as e:
                logger.error(f"SnapTrade brokerages error: {e}")
                return []
        return []
    
    def delete_user(self, user_id: str) -> bool:
        """Delete SnapTrade user to free up connection slot"""
        if not self.sdk:
            logger.error("SnapTrade SDK not available")
            return False
            
        try:
            user_secret = user_secret_manager.get_snaptrade_secret(user_id)
            snaptrade_user_id = user_secret_manager.get_snaptrade_user_id(user_id)
            
            if not user_secret or not snaptrade_user_id:
                logger.info(f"No SnapTrade user found for {user_id}")
                return True
            
            logger.info(f"Deleting SnapTrade user: {snaptrade_user_id}")
            
            response = self.sdk.authentication.delete_snap_trade_user(
                user_id=snaptrade_user_id,
                user_secret=user_secret
            )
            
            # Clear stored credentials
            user_secret_manager.delete_snaptrade_secret(user_id)
            user_secret_manager.delete_snaptrade_user_id(user_id)
            
            logger.info(f"SnapTrade user deleted successfully: {snaptrade_user_id}")
            return True
                
        except Exception as e:
            logger.error(f"SnapTrade delete user error: {e}")
            return False
    
    def get_redirect_uri(self, user_id: str, brokerage_id: str = None) -> str:
        """Generate SnapTrade redirect URI with retry mechanism"""
        if not self.sdk:
            logger.error("SnapTrade SDK not available")
            return ''
        
        user_secret = user_secret_manager.get_snaptrade_secret(user_id)
        snaptrade_user_id = user_secret_manager.get_snaptrade_user_id(user_id) or user_id
        
        if not user_secret:
            logger.error(f"No user secret found for {user_id}")
            return ''
        
        # Create cleanup function for connection limit handling
        cleanup_func = create_zerodha_cleanup_func(self, user_id)
        
        def _get_redirect_uri_internal():
            logger.info(f"Generating redirect URI for user {snaptrade_user_id} with secret {user_secret[:8]}...")
            
            response = self.sdk.authentication.login_snap_trade_user(
                user_id=snaptrade_user_id,
                user_secret=user_secret
            )
            
            logger.info(f"SnapTrade response: {response}")
            
            if hasattr(response, 'body') and 'redirectURI' in response.body:
                redirect_uri = response.body['redirectURI']
                logger.info(f"Generated redirect URI successfully: {redirect_uri[:50]}...")
                return redirect_uri
            elif hasattr(response, 'body'):
                logger.error(f"Response body missing redirectURI: {response.body}")
                raise Exception("Response body missing redirectURI")
            else:
                logger.error(f"Response has no body attribute: {type(response)}")
                raise Exception("Response has no body attribute")
        
        try:
            return retry_manager.retry_with_backoff(
                _get_redirect_uri_internal,
                max_retries=3,
                connection_cleanup_func=cleanup_func
            )
        except Exception as e:
            error_msg = str(e)
            if "Connection Limit Reached" in error_msg or "maximum number of connections" in error_msg:
                logger.error(f"SnapTrade connection limit reached after retries: {e}")
                return "CONNECTION_LIMIT_REACHED"
            logger.error(f"SnapTrade redirect URI error: {e}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            return ''

# Global instance
snaptrade_client = SnapTradeClient() if Config.SNAPTRADE_CLIENT_ID else None