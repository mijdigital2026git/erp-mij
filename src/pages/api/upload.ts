import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadFileToDrive, getDriveAccessToken } from '../../utils/googleDrive';

export const POST: APIRoute = async (context) => {
  try {

    const formData = await context.request.formData();
    const file = formData.get('video') as File | null;
    const customFolderId = formData.get('folderId') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No video file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accessToken = await getDriveAccessToken(context);
    
    // Cloudflare environment variables can also specify default folder ID
    const envFolderId = env?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
    const folderId = customFolderId || envFolderId || undefined;

    const result = await uploadFileToDrive({
      accessToken,
      fileName: file.name,
      fileType: file.type || 'video/mp4',
      fileBlob: file,
      folderId
    });

    return new Response(JSON.stringify({ success: true, file: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Upload API error:', error);
    let errMsg = error.message || 'Internal server error';
    if (errMsg.includes('Google Drive API has not been used') || errMsg.includes('SERVICE_DISABLED') || errMsg.includes('accessNotConfigured')) {
      errMsg = "Google Drive API is disabled on project 812430784237. Please enable it in Google Cloud Console: https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=812430784237";
    }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
