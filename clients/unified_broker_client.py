#!/usr/bin/env python3
"""Unified Multi-Broker Client"""

import pandas as pd
from typing import List, Dict, Optional
from utils.logger import logger
from clients.snaptrade_client import snaptrade_client
from clients.plaid_client import plaid_client

class UnifiedBrokerClient:
    def __init__(self):
        self.clients = {
            'snaptrade': snaptrade_client,
            'plaid': plaid_client
        }
    
    def get_available_clients(self) -> List[str]:
        """Get list of available broker clients"""
        return [name for name, client in self.clients.items() if client is not None]
    
    def get_all_accounts(self, user_id: str) -> Dict[str, List[Dict]]:
        """Get accounts from all available brokers"""
        all_accounts = {}
        
        for name, client in self.clients.items():
            if client:
                try:
                    accounts = client.get_accounts(user_id)
                    if accounts:
                        all_accounts[name] = accounts
                        logger.info(f"{name}: {len(accounts)} accounts")
                except Exception as e:
                    logger.error(f"{name} accounts error: {e}")
        
        return all_accounts
    
    def get_all_holdings(self, user_id: str) -> pd.DataFrame:
        """Get holdings from all brokers and combine"""
        all_holdings = []
        
        for name, client in self.clients.items():
            if client:
                try:
                    holdings_df = client.get_holdings(user_id)
                    if not holdings_df.empty:
                        holdings_df['broker'] = name
                        all_holdings.append(holdings_df)
                        logger.info(f"{name}: {len(holdings_df)} holdings")
                except Exception as e:
                    logger.error(f"{name} holdings error: {e}")
        
        if all_holdings:
            combined_df = pd.concat(all_holdings, ignore_index=True)
            
            # Standardize columns
            standard_columns = ['symbol', 'quantity', 'avg_cost', 'market_value', 'broker']
            for col in standard_columns:
                if col not in combined_df.columns:
                    combined_df[col] = 0 if col in ['quantity', 'avg_cost', 'market_value'] else 'Unknown'
            
            return combined_df[standard_columns]
        
        return pd.DataFrame()
    
    def get_all_transactions(self, user_id: str, days: int = 30) -> pd.DataFrame:
        """Get transactions from all brokers and combine"""
        all_transactions = []
        
        for name, client in self.clients.items():
            if client:
                try:
                    transactions_df = client.get_transactions(user_id, days)
                    if not transactions_df.empty:
                        transactions_df['broker'] = name
                        all_transactions.append(transactions_df)
                        logger.info(f"{name}: {len(transactions_df)} transactions")
                except Exception as e:
                    logger.error(f"{name} transactions error: {e}")
        
        if all_transactions:
            combined_df = pd.concat(all_transactions, ignore_index=True)
            
            # Standardize columns
            standard_columns = ['date', 'ticker', 'action', 'shares', 'price', 'broker']
            for col in standard_columns:
                if col not in combined_df.columns:
                    if col == 'shares':
                        combined_df[col] = combined_df.get('quantity', 0)
                    elif col == 'price':
                        combined_df[col] = combined_df.get('amount', 0)
                    else:
                        combined_df[col] = 'Unknown'
            
            return combined_df[standard_columns]
        
        return pd.DataFrame()
    
    def get_connection_status(self, user_id: str) -> Dict[str, bool]:
        """Check connection status for all brokers"""
        status = {}
        
        for name, client in self.clients.items():
            if client:
                try:
                    accounts = client.get_accounts(user_id)
                    status[name] = len(accounts) > 0
                except:
                    status[name] = False
            else:
                status[name] = False
        
        return status

# Global instance
unified_client = UnifiedBrokerClient()