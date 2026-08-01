import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadFileToDrive, getDriveAccessToken } from '../../../utils/googleDrive';

export const POST: APIRoute = async (context) => {
  try {
    const user = (context.locals as any).user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const formData = await context.request.formData();
    const videoFile = formData.get('video') as File | null;
    const category = formData.get('category') as string || 'UI Bug';

    if (!videoFile || videoFile.size === 0) {
      return new Response(JSON.stringify({ error: 'No video file provided.' }), { status: 400 });
    }

    const accessToken = await getDriveAccessToken(env);
    const envFolderId = env?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
    const folderId = envFolderId || undefined;

    const fileExt = videoFile.name.split('.').pop() || 'mp4';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanFileName = `COMPLAINT_${user.name.toUpperCase().replace(/\s+/g, '_')}_${category.toUpperCase().replace(/\s+/g, '_')}_${timestamp}.${fileExt}`;

    const uploadResult = await uploadFileToDrive({
      accessToken,
      fileName: cleanFileName,
      fileType: videoFile.type || 'video/mp4',
      fileBlob: videoFile,
      folderId
    });

    const videoUrl = uploadResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}`;

    return new Response(JSON.stringify({ success: true, videoUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('File upload API error:', error);
    let errMsg = error.message || 'Internal server error';
    if (errMsg.includes('storageQuotaExceeded') || errMsg.includes('storage quota') || errMsg.includes('quota')) {
      errMsg = "Google Drive Storage Quota Exceeded. Service Accounts do not have storage quota on personal 'My Drive' folders. Please use a Shared Drive (Workspace) and add the Service Account as a member, or check your Drive configuration.";
    }
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
};
