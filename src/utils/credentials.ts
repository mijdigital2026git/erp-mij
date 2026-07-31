interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Loads Google OAuth 2.0 Credentials (Client ID, Client Secret, Refresh Token).
 */
export async function getGoogleOAuthCredentials(runtimeEnv?: Record<string, any>): Promise<GoogleOAuthCredentials> {
  const clientId = runtimeEnv?.GOOGLE_CLIENT_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_ID : undefined);
  const clientSecret = runtimeEnv?.GOOGLE_CLIENT_SECRET || (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_SECRET : undefined);
  const refreshToken = runtimeEnv?.GOOGLE_REFRESH_TOKEN || (typeof process !== 'undefined' ? process.env.GOOGLE_REFRESH_TOKEN : undefined);

  if (clientId && clientSecret && refreshToken) {
    return {
      clientId,
      clientSecret,
      refreshToken
    };
  }

  throw new Error('Google OAuth credentials not found. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in your environment.');
}
