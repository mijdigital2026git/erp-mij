/**
 * Google Drive upload utility supporting both Service Account (JWT) and OAuth 2.0 Client credentials.
 * No external dependencies, fully compatible with Cloudflare Pages Functions & Web Crypto API.
 */

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
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
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

/**
 * Unified access token retriever that auto-detects and uses either Service Account or OAuth Client
 */
export async function getDriveAccessToken(runtimeEnv?: any): Promise<string> {
  const clientEmail = runtimeEnv?.GOOGLE_CLIENT_EMAIL || (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_EMAIL : undefined);
  const privateKeyPEM = runtimeEnv?.GOOGLE_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env.GOOGLE_PRIVATE_KEY : undefined);

  if (clientEmail && privateKeyPEM) {
    const cleanedKey = privateKeyPEM.replace(/\\n/g, '\n');
    return await getServiceAccountAccessToken(clientEmail, cleanedKey);
  }

  const clientId = runtimeEnv?.GOOGLE_CLIENT_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_ID : undefined);
  const clientSecret = runtimeEnv?.GOOGLE_CLIENT_SECRET || (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_SECRET : undefined);
  const refreshToken = runtimeEnv?.GOOGLE_REFRESH_TOKEN || (typeof process !== 'undefined' ? process.env.GOOGLE_REFRESH_TOKEN : undefined);

  if (clientId && clientSecret && refreshToken) {
    return await getOAuthAccessToken(clientId, clientSecret, refreshToken);
  }

  throw new Error('Google Drive configuration not found. Please set either Service Account (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY) or OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) in your environment.');
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
  const metadata: Record<string, any> = {
    name: fileName
  };
  
  if (folderId) {
    metadata.parents = [folderId];
  }
  
  // 1. Initial request to get the session URL
  const initResponse = await fetch(
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
