/**
 * Google Calendar Integration - OAuth2 Authentication
 */

import type {
  GoogleOAuthConfig,
  GoogleCredentials,
  TokenRefreshResponse,
  GoogleApiError,
} from './types';

/**
 * Default OAuth2 scopes for Google Calendar
 */
export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Google OAuth2 endpoints
 */
export const GOOGLE_OAUTH_ENDPOINTS = {
  authUri: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUri: 'https://oauth2.googleapis.com/token',
  revokeUri: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Google Calendar OAuth2 client
 */
export class GoogleCalendarAuth {
  private config: GoogleOAuthConfig;
  private credentials?: GoogleCredentials;

  constructor(config: GoogleOAuthConfig) {
    this.config = {
      ...config,
      scopes: config.scopes || DEFAULT_SCOPES,
    };
  }

  /**
   * Generate authorization URL for OAuth2 flow
   * 
   * @param state Optional state parameter for CSRF protection
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes!.join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent', // Force to get refresh token
    });

    if (state) {
      params.append('state', state);
    }

    return `${GOOGLE_OAUTH_ENDPOINTS.authUri}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for credentials
   * 
   * @param code Authorization code from callback
   * @returns Google credentials with access and refresh tokens
   */
  async handleCallback(code: string): Promise<GoogleCredentials> {
    const params = new URLSearchParams({
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.tokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json() as GoogleApiError;
      throw new Error(
        `Failed to exchange code for token: ${error.error.message}`
      );
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      scope?: string;
    };
    
    this.credentials = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      expiry_date: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };

    return this.credentials;
  }

  /**
   * Refresh access token using refresh token
   * 
   * @param refreshToken Refresh token from previous authorization
   * @returns New credentials with updated access token
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<GoogleCredentials> {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch(GOOGLE_OAUTH_ENDPOINTS.tokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json() as GoogleApiError;
      throw new Error(
        `Failed to refresh token: ${error.error.message}`
      );
    }

    const data = await response.json() as TokenRefreshResponse;

    this.credentials = {
      access_token: data.access_token,
      refresh_token: refreshToken, // Keep the existing refresh token
      token_type: data.token_type,
      expiry_date: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };

    return this.credentials;
  }

  /**
   * Revoke access token
   * 
   * @param token Access or refresh token to revoke
   */
  async revokeToken(token: string): Promise<void> {
    const params = new URLSearchParams({ token });

    const response = await fetch(
      `${GOOGLE_OAUTH_ENDPOINTS.revokeUri}?${params.toString()}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error('Failed to revoke token');
    }

    this.credentials = undefined;
  }

  /**
   * Check if credentials are valid (not expired)
   */
  isTokenValid(credentials: GoogleCredentials): boolean {
    if (!credentials.expiry_date) {
      return true; // Assume valid if no expiry
    }
    // Add 5 minute buffer
    return credentials.expiry_date > Date.now() + 5 * 60 * 1000;
  }

  /**
   * Get current credentials
   */
  getCredentials(): GoogleCredentials | undefined {
    return this.credentials;
  }

  /**
   * Set credentials (e.g., loaded from storage)
   */
  setCredentials(credentials: GoogleCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Ensure credentials are valid, refreshing if necessary
   * 
   * @param credentials Current credentials
   * @returns Valid credentials
   */
  async ensureValidCredentials(
    credentials: GoogleCredentials
  ): Promise<GoogleCredentials> {
    if (this.isTokenValid(credentials)) {
      return credentials;
    }

    if (!credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    return this.refreshAccessToken(credentials.refresh_token);
  }
}
