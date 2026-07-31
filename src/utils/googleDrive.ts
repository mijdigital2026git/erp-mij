/**
 * Google Drive upload utility using native Web Crypto API for RS256 JWT signing.
 * No external dependencies, fully compatible with Cloudflare Pages Functions.
 */

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper to convert ArrayBuffer to Base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Helper to convert string to Base64url
function stringToBase64Url(str: string): string {
  const encoder = new TextEncoder();
  return arrayBufferToBase64Url(encoder.encode(str).buffer);
}

/**
 * Import the PKCS#8 private key from PEM string
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  
  const binaryKey = base64ToArrayBuffer(cleaned);
  
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }
    },
    false,
    ["sign"]
  );
}

/**
 * Generate a JWT assertion for Google OAuth
 */
async function generateJwt(clientEmail: string, privateKeyPem: string): Promise<string> {
  const privateKey = await importPrivateKey(privateKeyPem);
  
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  
  const unsignedToken = `${stringToBase64Url(JSON.stringify(header))}.${stringToBase64Url(JSON.stringify(payload))}`;
  
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    encoder.encode(unsignedToken)
  );
  
  const signature = arrayBufferToBase64Url(signatureBuffer);
  return `${unsignedToken}.${signature}`;
}

/**
 * Get OAuth2 access token using the service account credentials
 */
export async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const jwt = await generateJwt(clientEmail, privateKeyPem);
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Google access token: ${response.statusText} - ${errorText}`);
  }
  
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

interface UploadParams {
  clientEmail: string;
  privateKeyPem: string;
  fileName: string;
  fileType: string;
  fileBlob: Blob;
  folderId?: string;
}

/**
 * Upload a file to Google Drive using multipart upload
 */
export async function uploadFileToDrive({
  clientEmail,
  privateKeyPem,
  fileName,
  fileType,
  fileBlob,
  folderId
}: UploadParams): Promise<{ id: string; name: string; webViewLink?: string }> {
  const accessToken = await getAccessToken(clientEmail, privateKeyPem);
  
  const metadata: Record<string, any> = {
    name: fileName
  };
  
  if (folderId) {
    metadata.parents = [folderId];
  }
  
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  
  const metadataPart = 
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + '\r\n';
    
  const mediaPartHeader = 
    `Content-Type: ${fileType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n`;
  
  // Convert blob to base64
  const arrayBuffer = await fileBlob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Media = btoa(binary);
  
  // Combine body parts
  const body = 
    delimiter + 
    metadataPart + 
    delimiter + 
    mediaPartHeader + 
    base64Media + 
    closeDelimiter;
    
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: body
    }
  );
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive upload failed: ${response.statusText} - ${errorText}`);
  }
  
  return (await response.json()) as { id: string; name: string; webViewLink?: string };
}
