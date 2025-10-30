"""Connection retry mechanism for handling API rate limits and connection limits"""

import time
import random
from typing import Callable, Any, Optional, Dict, List
from functools import wraps
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ConnectionRetryManager:
    """Manages connection retries with exponential backoff and connection limit handling"""
    
    def __init__(self):
        self.connection_attempts = {}
        self.last_attempt_time = {}
        self.backoff_multiplier = 2
        self.max_retries = 5
        self.base_delay = 1  # seconds
        self.max_delay = 300  # 5 minutes
        self.jitter_range = 0.1  # 10% jitter
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay with exponential backoff and jitter"""
        delay = min(self.base_delay * (self.backoff_multiplier ** attempt), self.max_delay)
        jitter = delay * self.jitter_range * (2 * random.random() - 1)
        return max(0, delay + jitter)
    
    def _should_retry(self, error_msg: str) -> bool:
        """Check if error is retryable"""
        retryable_errors = [
            "Connection Limit Reached",
            "maximum number of connections",
            "rate limit",
            "too many requests",
            "service unavailable",
            "timeout",
            "connection reset",
            "connection refused"
        ]
        return any(err.lower() in error_msg.lower() for err in retryable_errors)
    
    def _is_connection_limit_error(self, error_msg: str) -> bool:
        """Check if error is specifically a connection limit error"""
        connection_limit_errors = [
            "Connection Limit Reached",
            "maximum number of connections",
            "connection limit exceeded"
        ]
        return any(err.lower() in error_msg.lower() for err in connection_limit_errors)
    
    def retry_with_backoff(self, 
                          func: Callable,
                          *args,
                          max_retries: Optional[int] = None,
                          connection_cleanup_func: Optional[Callable] = None,
                          **kwargs) -> Any:
        """
        Retry function with exponential backoff
        
        Args:
            func: Function to retry
            max_retries: Maximum number of retries (uses default if None)
            connection_cleanup_func: Function to call for connection cleanup on limit errors
            *args, **kwargs: Arguments to pass to func
        """
        max_retries = max_retries or self.max_retries
        func_name = func.__name__
        
        for attempt in range(max_retries + 1):
            try:
                result = func(*args, **kwargs)
                
                # Reset attempt counter on success
                if func_name in self.connection_attempts:
                    del self.connection_attempts[func_name]
                
                return result
                
            except Exception as e:
                error_msg = str(e)
                
                if attempt == max_retries:
                    logger.error(f"Max retries ({max_retries}) exceeded for {func_name}: {error_msg}")
                    raise
                
                if not self._should_retry(error_msg):
                    logger.error(f"Non-retryable error in {func_name}: {error_msg}")
                    raise
                
                # Handle connection limit errors
                if self._is_connection_limit_error(error_msg):
                    logger.warning(f"Connection limit reached for {func_name}, attempting cleanup")
                    
                    if connection_cleanup_func:
                        try:
                            cleanup_result = connection_cleanup_func()
                            logger.info(f"Connection cleanup result: {cleanup_result}")
                        except Exception as cleanup_error:
                            logger.error(f"Connection cleanup failed: {cleanup_error}")
                
                # Calculate delay
                delay = self._calculate_delay(attempt)
                
                # Track attempts
                self.connection_attempts[func_name] = attempt + 1
                self.last_attempt_time[func_name] = datetime.now()
                
                logger.warning(f"Attempt {attempt + 1}/{max_retries + 1} failed for {func_name}: {error_msg}")
                logger.info(f"Retrying in {delay:.2f} seconds...")
                
                time.sleep(delay)
        
        # This should never be reached due to the raise in the loop
        raise Exception(f"Unexpected end of retry loop for {func_name}")
    
    def get_retry_stats(self) -> Dict[str, Any]:
        """Get retry statistics"""
        return {
            'active_retries': dict(self.connection_attempts),
            'last_attempts': {k: v.isoformat() for k, v in self.last_attempt_time.items()},
            'config': {
                'max_retries': self.max_retries,
                'base_delay': self.base_delay,
                'max_delay': self.max_delay,
                'backoff_multiplier': self.backoff_multiplier
            }
        }
    
    def reset_retry_state(self, func_name: Optional[str] = None):
        """Reset retry state for specific function or all functions"""
        if func_name:
            self.connection_attempts.pop(func_name, None)
            self.last_attempt_time.pop(func_name, None)
        else:
            self.connection_attempts.clear()
            self.last_attempt_time.clear()

# Global retry manager instance
retry_manager = ConnectionRetryManager()

def retry_on_connection_limit(max_retries: int = 5, 
                             connection_cleanup_func: Optional[Callable] = None):
    """
    Decorator for automatic retry with connection limit handling
    
    Args:
        max_retries: Maximum number of retries
        connection_cleanup_func: Function to call for connection cleanup
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return retry_manager.retry_with_backoff(
                func, 
                *args, 
                max_retries=max_retries,
                connection_cleanup_func=connection_cleanup_func,
                **kwargs
            )
        return wrapper
    return decorator

def create_zerodha_cleanup_func(snaptrade_client, user_id: str) -> Callable:
    """Create a cleanup function for Zerodha/SnapTrade connection limits"""
    def cleanup():
        try:
            # Try to delete the current user to free up a connection slot
            if snaptrade_client:
                result = snaptrade_client.delete_user(user_id)
                logger.info(f"Deleted SnapTrade user {user_id} to free connection slot: {result}")
                return result
            return False
        except Exception as e:
            logger.error(f"Failed to cleanup connection for user {user_id}: {e}")
            return False
    
    return cleanup