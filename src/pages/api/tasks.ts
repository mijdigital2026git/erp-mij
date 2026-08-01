import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { uploadFileToDrive } from '../../utils/googleDrive';
import { getGoogleOAuthCredentials } from '../../utils/credentials';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(context.request.url);
    const projectId = url.searchParams.get('projectId');

    let query;
    let bindings = [];

    if (user.role === 'client') {
      if (projectId) {
        query = 'SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.project_id = ? AND p.client_id = ? ORDER BY t.created_at DESC';
        bindings.push(projectId, user.id);
      } else {
        query = 'SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.client_id = ? ORDER BY t.created_at DESC';
        bindings.push(user.id);
      }
    } else {
      if (projectId) {
        query = 'SELECT t.*, u.name as client_name, p.name as project_name FROM tasks t JOIN projects p ON t.project_id = p.id JOIN users u ON p.client_id = u.id WHERE t.project_id = ? ORDER BY t.created_at DESC';
        bindings.push(projectId);
      } else {
        query = 'SELECT t.*, u.name as client_name, p.name as project_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON p.client_id = u.id ORDER BY t.created_at DESC';
      }
    }

    const queryResult = await db.prepare(query).bind(...bindings).all();
    const tasks = queryResult.results;

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
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    if (user.role !== 'client') {
      return new Response(JSON.stringify({ error: 'Only clients can submit complains.' }), { status: 403 });
    }

    const formData = await context.request.formData();
    const category = formData.get('category') as string;
    const title = formData.get('title') as string || category;
    const description = (formData.get('description') as string || '').trim();
    const videoFile = formData.get('video') as File | null;
    const customFolderId = formData.get('folderId') as string | null;
    let videoUrl = formData.get('videoUrl') as string | null;

    if (!category) {
      return new Response(JSON.stringify({ error: 'Category is required.' }), { status: 400 });
    }

    const hasDescription = description.length > 0;
    const hasFile = (videoFile && videoFile.size > 0) || (videoUrl && videoUrl.length > 0);

    if (!hasDescription && !hasFile) {
      return new Response(JSON.stringify({ error: 'Please provide either a description OR upload/record a media file.' }), { status: 400 });
    }

    if (!videoUrl && videoFile && videoFile.size > 0) {
      const runtime = (context.locals as any).runtime;
      const runtimeEnv = runtime?.env || env;
      const credentials = await getGoogleOAuthCredentials(runtimeEnv);
      const envFolderId = runtimeEnv?.GOOGLE_DRIVE_FOLDER_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_DRIVE_FOLDER_ID : undefined);
      const folderId = customFolderId || envFolderId || undefined;

      const fileExt = videoFile.name.split('.').pop() || 'mp4';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanFileName = `COMPLAINT_${user.name.toUpperCase().replace(/\s+/g, '_')}_${category.toUpperCase().replace(/\s+/g, '_')}_${timestamp}.${fileExt}`;

      const uploadResult = await uploadFileToDrive({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        refreshToken: credentials.refreshToken,
        fileName: cleanFileName,
        fileType: videoFile.type || 'video/mp4',
        fileBlob: videoFile,
        folderId
      });
      videoUrl = uploadResult.webViewLink || `https://drive.google.com/file/d/${uploadResult.id}`;
    }

    const parentTaskId = formData.get('parentTaskId') as string | null;
    const projectUpdateId = formData.get('projectUpdateId') as string | null;
    const projectId = formData.get('projectId') as string | null;
    let finalProjectId = projectId;
    
    if (!finalProjectId) {
      const defaultProj = await db
        .prepare('SELECT id FROM projects WHERE client_id = ? ORDER BY created_at ASC')
        .bind(user.id)
        .first();
      if (defaultProj) {
        finalProjectId = defaultProj.id;
      } else {
        return new Response(JSON.stringify({ error: 'No active project found for this client. Please create a project first.' }), { status: 400 });
      }
    }

    const taskId = crypto.randomUUID();
    const timestampStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const initialStory = `Created by ${user.name} on ${timestampStr}`;
    
    await db
      .prepare('INSERT INTO tasks (id, client_id, project_id, category, title, description, video_url, status, parent_task_id, project_update_id, story, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
      .bind(taskId, user.id, finalProjectId, category, title, description, videoUrl || '', 'review', parentTaskId || null, projectUpdateId || null, initialStory)
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
