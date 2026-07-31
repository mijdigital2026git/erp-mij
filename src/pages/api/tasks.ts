import type { APIRoute } from 'astro';
import { uploadFileToDrive } from '../../utils/googleDrive';
import { getGoogleCredentials } from '../../utils/credentials';

export const GET: APIRoute = async (context) => {
  try {
    const runtime = (context.locals as any).runtime;
    const db = runtime?.env?.DB;
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
    const runtime = (context.locals as any).runtime;
    const db = runtime?.env?.DB;
    const env = runtime?.env;
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

      const uploadResult = await uploadFileToDrive({
        clientEmail: credentials.clientEmail,
        privateKeyPem: credentials.privateKey,
        fileName: videoFile.name,
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
