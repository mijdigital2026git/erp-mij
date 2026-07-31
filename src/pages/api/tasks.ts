import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadFileToDrive } from '../../utils/googleDrive';
import { getGoogleCredentials } from '../../utils/credentials';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const sessionUser = context.cookies.get('session_user');

    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = JSON.parse(sessionUser.value);

    let tasks;
    if (user.role === 'client') {
      const queryResult = await db
        .prepare('SELECT * FROM tasks WHERE client_id = ? ORDER BY created_at DESC')
        .bind(user.id)
        .all();
      tasks = queryResult.results;
    } else {
      // Prof and Admin see all tasks along with client names
      const queryResult = await db
        .prepare('SELECT t.*, u.name as client_name FROM tasks t JOIN users u ON t.client_id = u.id ORDER BY t.created_at DESC')
        .all();
      tasks = queryResult.results;
    }

    return new Response(JSON.stringify({ success: true, tasks }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch tasks API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const sessionUser = context.cookies.get('session_user');

    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = JSON.parse(sessionUser.value);
    if (user.role !== 'client') {
      return new Response(JSON.stringify({ error: 'Only clients can submit complains.' }), { status: 403 });
    }

    const formData = await context.request.formData();
    const category = formData.get('category') as string;
    const description = formData.get('description') as string;
    const videoFile = formData.get('video') as File | null;
    const customFolderId = formData.get('folderId') as string | null;

    if (!category || !description) {
      return new Response(JSON.stringify({ error: 'Category and Description are required.' }), { status: 400 });
    }

    let videoUrl = null;

    if (videoFile && videoFile.size > 0) {
      const credentials = await getGoogleCredentials(env);
      const envFolderId = env?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
      const folderId = customFolderId || envFolderId || undefined;

      const fileExt = videoFile.name.split('.').pop() || 'mp4';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanFileName = `COMPLAINT_${user.name.toUpperCase().replace(/\s+/g, '_')}_${category.toUpperCase().replace(/\s+/g, '_')}_${timestamp}.${fileExt}`;

      const uploadResult = await uploadFileToDrive({
        clientEmail: credentials.clientEmail,
        privateKeyPem: credentials.privateKey,
        fileName: cleanFileName,
        fileType: videoFile.type || 'video/mp4',
        fileBlob: videoFile,
        folderId
      });
      videoUrl = uploadResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}`;
    }

    const taskId = crypto.randomUUID();
    
    await db
      .prepare('INSERT INTO tasks (id, client_id, category, description, video_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
      .bind(taskId, user.id, category, description, videoUrl, 'proses')
      .run();

    return new Response(JSON.stringify({ success: true, taskId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Create task API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
