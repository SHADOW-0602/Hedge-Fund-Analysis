
import requests
import random
import os
from typing import Optional

class LadderSession(requests.Session):
    """
    A requests.Session subclass that implements Ladder's rate-limit evasion techniques.
    
    Features:
    - Random X-Forwarded-For IP addresses
    - Googlebot or Rotation User-Agents
    - Automatic timeout handling
    """
    
    def __init__(self, user_agent: str = None):
        super().__init__()
        self.default_user_agent = user_agent or "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        self.headers.update({
            "User-Agent": self.default_user_agent,
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive"
        })
        
    def request(self, method, url, *args, **kwargs):
        """
        Override request to inject randomized headers per request.
        """
        # Generate a random IP for X-Forwarded-For to bypass IP-based rate limits
        # Ladder uses this technique to look like different clients via a proxy
        random_ip = self._generate_random_ip()
        
        # Merge with existing headers
        headers = kwargs.get('headers', {})
        if headers is None:
            headers = {}
            
        # Set evasion headers
        headers['X-Forwarded-For'] = random_ip
        headers['X-Real-IP'] = random_ip
        
        # Ensure User-Agent is set
        if 'User-Agent' not in headers:
            headers['User-Agent'] = self.default_user_agent
            
        kwargs['headers'] = headers
        
        # Randomize timeout slightly to appear more natural if not set
        if 'timeout' not in kwargs:
            kwargs['timeout'] = (5, 15)
            
        return super().request(method, url, *args, **kwargs)
    
    @staticmethod
    def _generate_random_ip():
        """Generate a random IP address to spoof X-Forwarded-For"""
        return ".".join(str(random.randint(0, 255)) for _ in range(4))

def get_ladder_session() -> requests.Session:
    """Factory function to get a configured LadderSession"""
    # Check if we should use the specific Googlebot UA that Ladder uses
    # or potentially rotate standard browser UAs
    use_googlebot = os.getenv('LADDER_USE_GOOGLEBOT', 'true').lower() == 'true'
    
    ua = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    if not use_googlebot:
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        
    session = LadderSession(user_agent=ua)
    return session
