/**
 * Google Drive upload utility using OAuth 2.0 Refresh Token.
 * No external dependencies, fully compatible with Cloudflare Pages Functions.
 */

/**
 * Get OAuth2 access token using the client credentials and refresh token
 */
export async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
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
    throw new Error(`Failed to obtain Google access token: ${response.statusText} - ${errorText}`);
  }
  
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

interface UploadParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fileName: string;
  fileType: string;
  fileBlob: Blob;
  folderId?: string;
}

/**
 * Upload a file to Google Drive using resumable upload (highly stable for large files, zero extra memory allocation)
 */
export async function uploadFileToDrive({
  clientId,
  clientSecret,
  refreshToken,
  fileName,
  fileType,
  fileBlob,
  folderId
}: UploadParams): Promise<{ id: string; name: string; webViewLink?: string }> {
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
  
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
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  fileId: string
): Promise<void> {
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
  
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

