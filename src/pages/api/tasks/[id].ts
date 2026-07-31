import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadFileToDrive } from '../../../utils/googleDrive';
import { getGoogleOAuthCredentials } from '../../../utils/credentials';

export const PATCH: APIRoute = async (context) => {
  try {
    const { id } = context.params;
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Check if task exists
    const task = await db
      .prepare('SELECT client_id, status FROM tasks WHERE id = ?')
      .bind(id)
      .first();

    if (!task) {
      return new Response(JSON.stringify({ error: 'Task not found.' }), { status: 404 });
    }

    const formData = await context.request.formData();

    // Client-specific edit logic
    if (user.role === 'client') {
      if (task.client_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden. You do not own this task.' }), { status: 403 });
      }

      const category = formData.get('category') as string | null;
      const description = formData.get('description') as string | null;
      const videoUrl = formData.get('videoUrl') as string | null;
      const videoFile = formData.get('video') as File | null;

      let finalVideoUrl = videoUrl;

      // Handle upload if file provided directly in edit
      if (!finalVideoUrl && videoFile && videoFile.size > 0) {
        const credentials = await getGoogleOAuthCredentials(env);
        const envFolderId = env?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
        const folderId = envFolderId || undefined;

        const fileExt = videoFile.name.split('.').pop() || 'mp4';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cleanFileName = `COMPLAINT_${user.name.toUpperCase().replace(/\s+/g, '_')}_${(category || 'EDIT').toUpperCase().replace(/\s+/g, '_')}_${timestamp}.${fileExt}`;

        const uploadResult = await uploadFileToDrive({
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          refreshToken: credentials.refreshToken,
          fileName: cleanFileName,
          fileType: videoFile.type || 'video/mp4',
          fileBlob: videoFile,
          folderId
        });
        finalVideoUrl = uploadResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}`;
      }

      let queryParts = [];
      let bindings = [];

      if (category) {
        queryParts.push('category = ?');
        bindings.push(category);
      }
      if (description) {
        queryParts.push('description = ?');
        bindings.push(description);
      }
      if (finalVideoUrl) {
        queryParts.push('video_url = ?');
        bindings.push(finalVideoUrl);
      }

      if (queryParts.length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update.' }), { status: 400 });
      }

      queryParts.push('updated_at = CURRENT_TIMESTAMP');
      bindings.push(id);

      const query = `UPDATE tasks SET ${queryParts.join(', ')} WHERE id = ?`;
      await db.prepare(query).bind(...bindings).run();

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Admin & Professional edit logic
    if (user.role !== 'admin' && user.role !== 'prof') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const status = formData.get('status') as string | null;
    const conclusion = formData.get('conclusion') as string | null;
    const imageFile = formData.get('image') as File | null;
    const customFolderId = formData.get('folderId') as string | null;

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
      const credentials = await getGoogleOAuthCredentials(env);
      const envFolderId = env?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
      const folderId = customFolderId || envFolderId || undefined;

      const fileExt = imageFile.name.split('.').pop() || 'png';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanFileName = `RESOLUTION_${id}_${timestamp}.${fileExt}`;

      const uploadResult = await uploadFileToDrive({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        refreshToken: credentials.refreshToken,
        fileName: cleanFileName,
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

export const DELETE: APIRoute = async (context) => {
  try {
    const { id } = context.params;
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const task = await db
      .prepare('SELECT client_id FROM tasks WHERE id = ?')
      .bind(id)
      .first();

    if (!task) {
      return new Response(JSON.stringify({ error: 'Task not found.' }), { status: 404 });
    }

    // Only Admin or the owning Client can delete tasks
    if (user.role !== 'admin' && task.client_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden. You do not own this task.' }), { status: 403 });
    }

    await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Delete task API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
