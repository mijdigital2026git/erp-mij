import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadFileToDrive } from '../../../utils/googleDrive';
import { getGoogleCredentials } from '../../../utils/credentials';

export const PATCH: APIRoute = async (context) => {
  try {
    const { id } = context.params;
    const db = (env as any).DB;
    const sessionUser = context.cookies.get('session_user');

    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = JSON.parse(sessionUser.value);
    if (user.role !== 'admin' && user.role !== 'prof') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const formData = await context.request.formData();
    const status = formData.get('status') as string | null;
    const conclusion = formData.get('conclusion') as string | null;
    const imageFile = formData.get('image') as File | null;
    const customFolderId = formData.get('folderId') as string | null;

    // Build UPDATE query dynamically
    let queryParts = [];
    let bindings = [];

    if (status) {
      queryParts.push('status = ?');
      bindings.push(status);
    }

    if (user.role === 'admin' && conclusion !== null) {
      queryParts.push('conclusion = ?');
      bindings.push(conclusion);
    }

    if (user.role === 'admin' && imageFile && imageFile.size > 0) {
      const credentials = await getGoogleCredentials(env);
      const envFolderId = env?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
      const folderId = customFolderId || envFolderId || undefined;

      const uploadResult = await uploadFileToDrive({
        clientEmail: credentials.clientEmail,
        privateKeyPem: credentials.privateKey,
        fileName: imageFile.name,
        fileType: imageFile.type || 'image/png',
        fileBlob: imageFile,
        folderId
      });
      const imageUrl = uploadResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}`;
      
      queryParts.push('image_url = ?');
      bindings.push(imageUrl);
    }

    if (queryParts.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update.' }), { status: 400 });
    }

    queryParts.push('updated_at = CURRENT_TIMESTAMP');
    
    // Add task ID to bindings
    bindings.push(id);

    const query = `UPDATE tasks SET ${queryParts.join(', ')} WHERE id = ?`;
    await db.prepare(query).bind(...bindings).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Update task API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
