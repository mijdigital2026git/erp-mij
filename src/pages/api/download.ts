import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const file = url.searchParams.get('file') || url.searchParams.get('type') || '';
  
  const procEnv = typeof process !== 'undefined' ? process.env : {};
  const cfEnv = (env as any) || {};

  const customRedirectUrl = cfEnv?.DOWNLOAD_REDIRECT_URL || procEnv?.DOWNLOAD_REDIRECT_URL;
  const driveFolderId = cfEnv?.GOOGLE_DRIVE_FOLDER_ID || procEnv?.GOOGLE_DRIVE_FOLDER_ID || '1zko_vNILEFc5AOvb0wPOzDGJ6xQHZBxT';

  // If a specific custom redirect URL is provided in env, use it; otherwise redirect to Google Drive folder
  const targetUrl = customRedirectUrl || `https://drive.google.com/drive/folders/${driveFolderId}`;

  return context.redirect(targetUrl, 302);
};
