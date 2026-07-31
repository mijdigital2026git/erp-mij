import type { APIRoute } from 'astro';
import { uploadFileToDrive } from '../../utils/googleDrive';
import { getGoogleOAuthCredentials } from '../../utils/credentials';

export const POST: APIRoute = async (context) => {
  try {
    // Retrieve environment variables from Cloudflare context if present
    const runtime = (context.locals as any).runtime;
    const env = runtime?.env;

    const formData = await context.request.formData();
    const file = formData.get('video') as File | null;
    const customFolderId = formData.get('folderId') as string | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No video file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const credentials = await getGoogleOAuthCredentials(env);
    
    // Cloudflare environment variables can also specify default folder ID
    const envFolderId = env?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
    const folderId = customFolderId || envFolderId || undefined;

    const result = await uploadFileToDrive({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      refreshToken: credentials.refreshToken,
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
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
