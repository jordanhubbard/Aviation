/**
 * Google Calendar Integration - Auth Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoogleCalendarAuth, DEFAULT_SCOPES, GOOGLE_OAUTH_ENDPOINTS } from '../auth';
import type { GoogleCredentials } from '../types';

describe('GoogleCalendarAuth', () => {
  let auth: GoogleCalendarAuth;

  beforeEach(() => {
    auth = new GoogleCalendarAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL', () => {
      const url = auth.getAuthorizationUrl('state123');
      
      expect(url).toContain(GOOGLE_OAUTH_ENDPOINTS.authUri);
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=http');
      expect(url).toContain('state=state123');
      expect(url).toContain('access_type=offline');
    });

    it('should include default scopes', () => {
      const url = auth.getAuthorizationUrl();
      
      expect(url).toContain(encodeURIComponent(DEFAULT_SCOPES[0]));
    });

    it('should work without state parameter', () => {
      const url = auth.getAuthorizationUrl();
      
      expect(url).toContain('client_id=test-client-id');
      expect(url).not.toContain('state=');
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid token', () => {
      const credentials: GoogleCredentials = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expiry_date: Date.now() + 60 * 60 * 1000, // 1 hour from now
      };
      
      expect(auth.isTokenValid(credentials)).toBe(true);
    });

    it('should return false for expired token', () => {
      const credentials: GoogleCredentials = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expiry_date: Date.now() - 1000, // 1 second ago
      };
      
      expect(auth.isTokenValid(credentials)).toBe(false);
    });

    it('should return true when no expiry date', () => {
      const credentials: GoogleCredentials = {
        access_token: 'test-token',
        token_type: 'Bearer',
      };
      
      expect(auth.isTokenValid(credentials)).toBe(true);
    });

    it('should have 5 minute buffer', () => {
      const credentials: GoogleCredentials = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expiry_date: Date.now() + 4 * 60 * 1000, // 4 minutes from now
      };
      
      // Should be considered invalid due to 5 minute buffer
      expect(auth.isTokenValid(credentials)).toBe(false);
    });
  });

  describe('setCredentials / getCredentials', () => {
    it('should store and retrieve credentials', () => {
      const credentials: GoogleCredentials = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600 * 1000,
      };
      
      auth.setCredentials(credentials);
      
      expect(auth.getCredentials()).toEqual(credentials);
    });

    it('should return undefined initially', () => {
      expect(auth.getCredentials()).toBeUndefined();
    });
  });
});
