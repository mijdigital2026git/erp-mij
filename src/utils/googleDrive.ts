/**
 * Google Drive upload utility supporting both Service Account (JWT) and OAuth 2.0 Client credentials.
 * No external dependencies, fully compatible with Cloudflare Pages Functions & Web Crypto API.
 */

// Helper to clean quotes and whitespace from environment variables
export function sanitizeEnvValue(val: any): string {
  if (typeof val !== 'string') return '';
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned.trim();
}

// Helper to base64url encode strings and Uint8Arrays
function base64url(strOrUint8: string | Uint8Array): string {
  let binary = "";
  if (typeof strOrUint8 === "string") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(strOrUint8);
    return base64url(bytes);
  } else {
    strOrUint8.forEach(b => binary += String.fromCharCode(b));
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Convert PEM private key to ArrayBuffer
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const unescaped = pem.replace(/\\n/g, '\n');
  let b64 = unescaped
    .replace(/-----BEGIN PRIVATE KEY-----/gi, '')
    .replace(/-----END PRIVATE KEY-----/gi, '')
    .replace(/[^A-Za-z0-9+/=]/g, '');

  while (b64.length % 4 !== 0) {
    b64 += '=';
  }
  
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Get access token using Google Service Account JWT
 */
export async function getServiceAccountAccessToken(clientEmail: string, privateKeyPEM: string): Promise<string> {
  const keyData = pemToArrayBuffer(privateKeyPEM);
  
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }
    },
    false,
    ["sign"]
  );

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encoder = new TextEncoder();
  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(unsignedToken)
  );
  const signature = base64url(new Uint8Array(signatureBuffer));
  const jwt = `${unsignedToken}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Google access token via Service Account: ${response.statusText} - ${errorText}`);
  }
  
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Get access token using OAuth2 Refresh Token
 */
export async function getOAuthAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Google access token via OAuth: ${response.statusText} - ${errorText}`);
  }
  
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

import { env } from 'cloudflare:workers';

/**
 * Unified access token retriever that auto-detects and uses either Service Account or OAuth Client
 */
export async function getDriveAccessToken(runtimeEnv?: any): Promise<string> {
  const cfEnv = (env as any) || {};
  const procEnv = typeof process !== 'undefined' ? process.env : {};
  const ctxEnv = runtimeEnv?.locals?.runtime?.env || runtimeEnv?.locals?.env || runtimeEnv?.env || {};

  const rawClientId = ctxEnv?.GOOGLE_CLIENT_ID || cfEnv?.GOOGLE_CLIENT_ID || procEnv?.GOOGLE_CLIENT_ID;
  const rawClientSecret = ctxEnv?.GOOGLE_CLIENT_SECRET || cfEnv?.GOOGLE_CLIENT_SECRET || procEnv?.GOOGLE_CLIENT_SECRET;
  const rawRefreshToken = ctxEnv?.GOOGLE_REFRESH_TOKEN || cfEnv?.GOOGLE_REFRESH_TOKEN || procEnv?.GOOGLE_REFRESH_TOKEN;

  const clientId = sanitizeEnvValue(rawClientId);
  const clientSecret = sanitizeEnvValue(rawClientSecret);
  const refreshToken = sanitizeEnvValue(rawRefreshToken);

  if (clientId && clientSecret && refreshToken) {
    try {
      return await getOAuthAccessToken(clientId, clientSecret, refreshToken);
    } catch (oauthErr: any) {
      console.warn('[Google Drive] OAuth token request failed. Checking Service Account fallback...', oauthErr?.message || oauthErr);
    }
  }

  const rawClientEmail = ctxEnv?.GOOGLE_CLIENT_EMAIL || cfEnv?.GOOGLE_CLIENT_EMAIL || procEnv?.GOOGLE_CLIENT_EMAIL;
  const rawPrivateKeyPEM = ctxEnv?.GOOGLE_PRIVATE_KEY || cfEnv?.GOOGLE_PRIVATE_KEY || procEnv?.GOOGLE_PRIVATE_KEY;

  const clientEmail = sanitizeEnvValue(rawClientEmail);
  const privateKeyPEM = sanitizeEnvValue(rawPrivateKeyPEM);

  if (clientEmail && privateKeyPEM) {
    return await getServiceAccountAccessToken(clientEmail, privateKeyPEM);
  }

  throw new Error('Google Drive configuration error: OAuth token request failed and no valid Service Account was found. Please update GOOGLE_REFRESH_TOKEN or Service Account credentials in Cloudflare Pages.');
}

interface UploadParams {
  accessToken: string;
  fileName: string;
  fileType: string;
  fileBlob: Blob;
  folderId?: string;
}

/**
 * Upload a file to Google Drive using resumable upload (highly stable for large files, zero extra memory allocation)
 */
export async function uploadFileToDrive({
  accessToken,
  fileName,
  fileType,
  fileBlob,
  folderId
}: UploadParams): Promise<{ id: string; name: string; webViewLink?: string }> {
  const sanitizedFolderId = sanitizeEnvValue(folderId);
  const metadata: Record<string, any> = {
    name: fileName
  };
  
  if (sanitizedFolderId) {
    metadata.parents = [sanitizedFolderId];
  }
  
  // 1. Initial request to get the session URL
  let initResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": fileType,
        "X-Upload-Content-Length": fileBlob.size.toString()
      },
      body: JSON.stringify(metadata)
    }
  );
  
  // Fail-safe fallback: if folderId is invalid/deleted/inaccessible (causes 404 or 400), upload directly to root Drive
  if (!initResponse.ok && folderId && (initResponse.status === 404 || initResponse.status === 400)) {
    console.warn(`[Google Drive] Target folder ${folderId} not found or inaccessible (HTTP ${initResponse.status}). Falling back to root Google Drive.`);
    delete metadata.parents;
    initResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": fileType,
          "X-Upload-Content-Length": fileBlob.size.toString()
        },
        body: JSON.stringify(metadata)
      }
    );
  }
  
  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`Google Drive resumable upload initialization failed: ${initResponse.statusText} - ${errorText}`);
  }
  
  const sessionUrl = initResponse.headers.get("Location");
  if (!sessionUrl) {
    throw new Error("Failed to get Google Drive resumable upload session URL (Location header missing)");
  }
  
  // 2. Stream the file content directly to the session URL
  const uploadResponse = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Type": fileType
    },
    body: fileBlob
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Google Drive resumable upload transfer failed: ${uploadResponse.statusText} - ${errorText}`);
  }
  
  return (await uploadResponse.json()) as { id: string; name: string; webViewLink?: string };
}

/**
 * Delete a file from Google Drive by fileId
 */
export async function deleteFileFromDrive(
  accessToken: string,
  fileId: string
): Promise<void> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    console.error(`Failed to delete Google Drive file ${fileId}: ${response.statusText} - ${errorText}`);
  }
}
