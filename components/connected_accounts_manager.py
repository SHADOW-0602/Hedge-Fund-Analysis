"""Connected accounts manager with individual delete functionality"""

import streamlit as st
import pandas as pd
from typing import List, Dict, Optional
from utils.user_secrets import user_secret_manager
from clients.snaptrade_client import snaptrade_client
from utils.logger import logger
from datetime import datetime

class ConnectedAccountsManager:
    """Manage connected SnapTrade accounts with individual delete functionality"""
    
    def __init__(self):
        self.client = snaptrade_client
    
    def render_connected_accounts(self, user_id: str):
        """Render connected accounts with delete functionality"""
        st.subheader("🏦 Connected Accounts")
        
        # Get all connected accounts
        connections = user_secret_manager.list_all_snaptrade_users()
        
        if not connections:
            st.info("No connected accounts found")
            return
        
        # Display accounts in a table format
        accounts_data = []
        for conn in connections:
            # Try to get account details if possible
            try:
                if self.client:
                    accounts = self.client.get_accounts(conn['app_user_id'])
                    account_count = len(accounts) if accounts else 0
                    status = "✅ Active" if accounts else "❌ Inactive"
                else:
                    account_count = "Unknown"
                    status = "❓ Unknown"
            except:
                account_count = "Error"
                status = "❌ Error"
            
            accounts_data.append({
                'User ID': conn['app_user_id'],
                'SnapTrade ID': conn['snaptrade_user_id'],
                'Created': conn['created_at'],
                'Accounts': account_count,
                'Status': status
            })
        
        # Display accounts table
        if accounts_data:
            accounts_df = pd.DataFrame(accounts_data)
            st.dataframe(accounts_df, use_container_width=True)
            
            # Individual account management
            st.subheader("🔧 Account Management")
            
            for i, conn in enumerate(connections):
                with st.expander(f"Account {i+1}: {conn['snaptrade_user_id'][:12]}..."):
                    col1, col2 = st.columns([3, 1])
                    
                    with col1:
                        st.write(f"**App User ID:** `{conn['app_user_id']}`")
                        st.write(f"**SnapTrade ID:** `{conn['snaptrade_user_id']}`")
                        st.write(f"**Created:** {conn['created_at']}")
                        
                        # Show account details if available
                        if self.client:
                            try:
                                accounts = self.client.get_accounts(conn['app_user_id'])
                                if accounts:
                                    st.success(f"✅ {len(accounts)} brokerage account(s) connected")
                                    for acc in accounts:
                                        st.write(f"  • {acc.get('name', 'Unknown')} ({acc.get('type', 'Unknown Type')})")
                                else:
                                    st.warning("⚠️ No brokerage accounts found")
                            except Exception as e:
                                st.error(f"❌ Error fetching accounts: {str(e)}")
                    
                    with col2:
                        # Delete button for individual account
                        if st.button(
                            "🗑️ Delete User", 
                            key=f"delete_user_{i}",
                            type="secondary",
                            help="Remove this SnapTrade connection"
                        ):
                            if self._delete_individual_user(conn):
                                st.success("✅ User deleted successfully!")
                                st.rerun()
                            else:
                                st.error("❌ Failed to delete user")
            
            # Bulk operations
            st.subheader("🔄 Bulk Operations")
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("🗑️ Delete All Users", type="secondary"):
                    if st.session_state.get('confirm_delete_all'):
                        deleted_count = self._delete_all_users()
                        st.success(f"✅ Deleted {deleted_count} users")
                        st.session_state.confirm_delete_all = False
                        st.rerun()
                    else:
                        st.session_state.confirm_delete_all = True
                        st.warning("⚠️ Click again to confirm deletion of ALL users")
            
            with col2:
                if st.button("🔄 Refresh Status", type="primary"):
                    st.rerun()
            
            # Show confirmation warning
            if st.session_state.get('confirm_delete_all'):
                st.error("⚠️ **WARNING**: This will delete ALL connected users. Click 'Delete All Users' again to confirm.")
        
        # Connection statistics
        self._show_connection_stats(connections)
    
    def _delete_individual_user(self, connection: Dict) -> bool:
        """Delete an individual SnapTrade user"""
        try:
            app_user_id = connection['app_user_id']
            snaptrade_user_id = connection['snaptrade_user_id']
            
            logger.info(f"Deleting SnapTrade user: {snaptrade_user_id}")
            
            # Try to delete from SnapTrade API
            api_success = False
            if self.client:
                try:
                    api_success = self.client.delete_user(app_user_id)
                    if api_success:
                        logger.info(f"Successfully deleted from SnapTrade API: {snaptrade_user_id}")
                    else:
                        logger.warning(f"API deletion failed for: {snaptrade_user_id}")
                except Exception as e:
                    logger.error(f"API deletion error for {snaptrade_user_id}: {e}")
            
            # Always clear local storage
            secret_deleted = user_secret_manager.delete_snaptrade_secret(app_user_id)
            user_id_deleted = user_secret_manager.delete_snaptrade_user_id(app_user_id)
            
            # Clear session state if this is the current user
            if 'snaptrade_connected' in st.session_state:
                current_user_secret = user_secret_manager.get_snaptrade_secret(app_user_id)
                if not current_user_secret:
                    st.session_state.snaptrade_connected = False
                    if 'snaptrade_accounts' in st.session_state:
                        del st.session_state.snaptrade_accounts
            
            success = secret_deleted or user_id_deleted
            if success:
                logger.info(f"Local storage cleared for: {snaptrade_user_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Error deleting individual user: {e}")
            return False
    
    def _delete_all_users(self) -> int:
        """Delete all SnapTrade users"""
        connections = user_secret_manager.list_all_snaptrade_users()
        deleted_count = 0
        
        for conn in connections:
            if self._delete_individual_user(conn):
                deleted_count += 1
        
        # Clear all session state
        if 'snaptrade_connected' in st.session_state:
            del st.session_state.snaptrade_connected
        if 'snaptrade_accounts' in st.session_state:
            del st.session_state.snaptrade_accounts
        
        logger.info(f"Bulk deleted {deleted_count} SnapTrade users")
        return deleted_count
    
    def _show_connection_stats(self, connections: List[Dict]):
        """Show connection statistics"""
        if not connections:
            return
        
        st.subheader("📊 Connection Statistics")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric("Total Connections", len(connections))
        
        with col2:
            # Count active connections
            active_count = 0
            if self.client:
                for conn in connections:
                    try:
                        accounts = self.client.get_accounts(conn['app_user_id'])
                        if accounts:
                            active_count += 1
                    except:
                        pass
            st.metric("Active Connections", active_count)
        
        with col3:
            # Show oldest connection
            if connections:
                oldest_date = min(conn['created_at'] for conn in connections)
                st.metric("Oldest Connection", oldest_date[:10])
        
        # Connection health
        if self.client and connections:
            health_data = []
            for conn in connections:
                try:
                    accounts = self.client.get_accounts(conn['app_user_id'])
                    status = "Healthy" if accounts else "Inactive"
                    account_count = len(accounts) if accounts else 0
                except Exception as e:
                    status = "Error"
                    account_count = 0
                
                health_data.append({
                    'User ID': conn['app_user_id'][:8] + "...",
                    'Status': status,
                    'Accounts': account_count
                })
            
            if health_data:
                st.write("**Connection Health:**")
                health_df = pd.DataFrame(health_data)
                
                # Color code the status
                def color_status(val):
                    if val == "Healthy":
                        return 'background-color: lightgreen'
                    elif val == "Inactive":
                        return 'background-color: lightyellow'
                    else:
                        return 'background-color: lightcoral'
                
                styled_df = health_df.style.applymap(color_status, subset=['Status'])
                st.dataframe(styled_df, use_container_width=True)
    
    def render_quick_actions(self):
        """Render quick action buttons"""
        st.subheader("⚡ Quick Actions")
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            if st.button("🔍 Check All Connections", help="Verify all connections are working"):
                self._check_all_connections()
        
        with col2:
            if st.button("🧹 Cleanup Invalid", help="Remove connections that are no longer valid"):
                cleaned = self._cleanup_invalid_connections()
                if cleaned > 0:
                    st.success(f"✅ Cleaned up {cleaned} invalid connections")
                    st.rerun()
                else:
                    st.info("No invalid connections found")
        
        with col3:
            if st.button("📊 Export Connection Data", help="Download connection information"):
                self._export_connection_data()
    
    def _check_all_connections(self):
        """Check status of all connections"""
        connections = user_secret_manager.list_all_snaptrade_users()
        
        if not connections:
            st.info("No connections to check")
            return
        
        with st.spinner("Checking all connections..."):
            results = []
            
            for conn in connections:
                try:
                    if self.client:
                        accounts = self.client.get_accounts(conn['app_user_id'])
                        status = "✅ Active" if accounts else "❌ Inactive"
                        account_count = len(accounts) if accounts else 0
                    else:
                        status = "❓ Client unavailable"
                        account_count = 0
                except Exception as e:
                    status = f"❌ Error: {str(e)[:30]}..."
                    account_count = 0
                
                results.append({
                    'User ID': conn['app_user_id'][:12] + "...",
                    'Status': status,
                    'Accounts': account_count,
                    'Created': conn['created_at'][:10]
                })
            
            if results:
                st.write("**Connection Check Results:**")
                results_df = pd.DataFrame(results)
                st.dataframe(results_df, use_container_width=True)
    
    def _cleanup_invalid_connections(self) -> int:
        """Remove invalid connections"""
        connections = user_secret_manager.list_all_snaptrade_users()
        cleaned_count = 0
        
        for conn in connections:
            try:
                if self.client:
                    accounts = self.client.get_accounts(conn['app_user_id'])
                    if not accounts:
                        # Connection is invalid, remove it
                        if self._delete_individual_user(conn):
                            cleaned_count += 1
                            logger.info(f"Cleaned up invalid connection: {conn['snaptrade_user_id']}")
            except Exception as e:
                # Connection has errors, remove it
                if self._delete_individual_user(conn):
                    cleaned_count += 1
                    logger.info(f"Cleaned up error connection: {conn['snaptrade_user_id']} - {e}")
        
        return cleaned_count
    
    def _export_connection_data(self):
        """Export connection data as CSV"""
        connections = user_secret_manager.list_all_snaptrade_users()
        
        if not connections:
            st.warning("No connections to export")
            return
        
        # Prepare export data
        export_data = []
        for conn in connections:
            try:
                if self.client:
                    accounts = self.client.get_accounts(conn['app_user_id'])
                    status = "Active" if accounts else "Inactive"
                    account_count = len(accounts) if accounts else 0
                else:
                    status = "Unknown"
                    account_count = 0
            except:
                status = "Error"
                account_count = 0
            
            export_data.append({
                'App User ID': conn['app_user_id'],
                'SnapTrade User ID': conn['snaptrade_user_id'],
                'Created Date': conn['created_at'],
                'Status': status,
                'Account Count': account_count,
                'Export Date': datetime.now().isoformat()
            })
        
        if export_data:
            export_df = pd.DataFrame(export_data)
            csv = export_df.to_csv(index=False)
            
            st.download_button(
                label="📥 Download Connection Data",
                data=csv,
                file_name=f"snaptrade_connections_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )

# Global instance
connected_accounts_manager = ConnectedAccountsManager()