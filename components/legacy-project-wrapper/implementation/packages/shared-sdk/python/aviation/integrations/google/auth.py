"""
Google Calendar Integration - OAuth2 Authentication
Python implementation matching TypeScript API
"""

import time
from typing import Optional
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request

from .types import GoogleCredentials, GoogleOAuthConfig


DEFAULT_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
]

GOOGLE_OAUTH_ENDPOINTS = {
    'auth_uri': 'https://accounts.google.com/o/oauth2/v2/auth',
    'token_uri': 'https://oauth2.googleapis.com/token',
    'revoke_uri': 'https://oauth2.googleapis.com/revoke',
}


class GoogleCalendarAuth:
    """Google Calendar OAuth2 authentication handler"""
    
    def __init__(self, config: GoogleOAuthConfig):
        self.config = config
        self.credentials: Optional[GoogleCredentials] = None
    
    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """
        Generate authorization URL for OAuth2 flow
        
        Args:
            state: Optional state parameter for CSRF protection
            
        Returns:
            Authorization URL to redirect user to
        """
        client_config = {
            'web': {
                'client_id': self.config.client_id,
                'client_secret': self.config.client_secret,
                'auth_uri': GOOGLE_OAUTH_ENDPOINTS['auth_uri'],
                'token_uri': GOOGLE_OAUTH_ENDPOINTS['token_uri'],
                'redirect_uris': [self.config.redirect_uri],
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=self.config.scopes,
            state=state,
        )
        flow.redirect_uri = self.config.redirect_uri
        
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',  # Force to get refresh token
        )
        
        return authorization_url
    
    def handle_callback(self, code: str, state: Optional[str] = None) -> GoogleCredentials:
        """
        Exchange authorization code for credentials
        
        Args:
            code: Authorization code from callback
            state: State parameter for validation
            
        Returns:
            Google credentials with access and refresh tokens
        """
        client_config = {
            'web': {
                'client_id': self.config.client_id,
                'client_secret': self.config.client_secret,
                'auth_uri': GOOGLE_OAUTH_ENDPOINTS['auth_uri'],
                'token_uri': GOOGLE_OAUTH_ENDPOINTS['token_uri'],
                'redirect_uris': [self.config.redirect_uri],
            }
        }
        
        flow = Flow.from_client_config(
            client_config,
            scopes=self.config.scopes,
            state=state,
        )
        flow.redirect_uri = self.config.redirect_uri
        flow.fetch_token(code=code)
        
        creds = flow.credentials
        
        # Convert to our GoogleCredentials format
        expiry_ms = None
        if creds.expiry:
            expiry_ms = int(creds.expiry.timestamp() * 1000)
        
        self.credentials = GoogleCredentials(
            access_token=creds.token,
            refresh_token=creds.refresh_token,
            token_type='Bearer',
            expiry_date=expiry_ms,
            scope=' '.join(self.config.scopes),
        )
        
        return self.credentials
    
    def refresh_access_token(self, refresh_token: str) -> GoogleCredentials:
        """
        Refresh access token using refresh token
        
        Args:
            refresh_token: Refresh token from previous authorization
            
        Returns:
            New credentials with updated access token
        """
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri=GOOGLE_OAUTH_ENDPOINTS['token_uri'],
            client_id=self.config.client_id,
            client_secret=self.config.client_secret,
            scopes=self.config.scopes,
        )
        
        creds.refresh(Request())
        
        expiry_ms = None
        if creds.expiry:
            expiry_ms = int(creds.expiry.timestamp() * 1000)
        
        self.credentials = GoogleCredentials(
            access_token=creds.token,
            refresh_token=refresh_token,  # Keep existing refresh token
            token_type='Bearer',
            expiry_date=expiry_ms,
            scope=' '.join(self.config.scopes),
        )
        
        return self.credentials
    
    def is_token_valid(self, credentials: GoogleCredentials) -> bool:
        """
        Check if credentials are valid (not expired)
        
        Args:
            credentials: Credentials to check
            
        Returns:
            True if token is valid
        """
        if not credentials.expiry_date:
            return True  # Assume valid if no expiry
        
        # Add 5 minute buffer (in milliseconds)
        buffer_ms = 5 * 60 * 1000
        current_ms = int(time.time() * 1000)
        
        return credentials.expiry_date > (current_ms + buffer_ms)
    
    def ensure_valid_credentials(self, credentials: GoogleCredentials) -> GoogleCredentials:
        """
        Ensure credentials are valid, refreshing if necessary
        
        Args:
            credentials: Current credentials
            
        Returns:
            Valid credentials
        """
        if self.is_token_valid(credentials):
            return credentials
        
        if not credentials.refresh_token:
            raise ValueError('No refresh token available')
        
        return self.refresh_access_token(credentials.refresh_token)
    
    def get_credentials(self) -> Optional[GoogleCredentials]:
        """Get current credentials"""
        return self.credentials
    
    def set_credentials(self, credentials: GoogleCredentials) -> None:
        """Set credentials (e.g., loaded from storage)"""
        self.credentials = credentials
