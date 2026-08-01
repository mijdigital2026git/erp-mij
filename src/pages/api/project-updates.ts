import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(context.request.url);
    const projectId = url.searchParams.get('projectId');
    let clientId = url.searchParams.get('clientId');

    if (user.role === 'client') {
      clientId = user.id;
    }

    let query;
    let bindings = [];

    if (projectId) {
      query = 'SELECT id, client_id, project_id, title, content, images, created_at, updated_at, (SELECT COUNT(*) FROM tasks WHERE project_update_id = project_updates.id) as replies_count FROM project_updates WHERE project_id = ? ORDER BY created_at DESC';
      bindings.push(projectId);
    } else if (clientId) {
      query = 'SELECT id, client_id, project_id, title, content, images, created_at, updated_at, (SELECT COUNT(*) FROM tasks WHERE project_update_id = project_updates.id) as replies_count FROM project_updates WHERE project_id IN (SELECT id FROM projects WHERE client_id = ?) ORDER BY created_at DESC';
      bindings.push(clientId);
    } else {
      query = 'SELECT id, client_id, project_id, title, content, images, created_at, updated_at, (SELECT COUNT(*) FROM tasks WHERE project_update_id = project_updates.id) as replies_count FROM project_updates ORDER BY created_at DESC';
    }

    const queryResult = await db.prepare(query).bind(...bindings).all();

    return new Response(JSON.stringify({ success: true, updates: queryResult.results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch project updates API error:', error);
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

    if (user.role !== 'admin' && user.role !== 'prof') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const body = await context.request.json();
    const { projectId, title, content, images } = body;

    if (!projectId || !title || !content) {
      return new Response(JSON.stringify({ error: 'Project ID, Title, and Content are required.' }), { status: 400 });
    }

    const project = await db
      .prepare('SELECT client_id FROM projects WHERE id = ?')
      .bind(projectId)
      .first();

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found.' }), { status: 404 });
    }

    const clientId = project.client_id;
    const updateId = `update-${Date.now()}`;

    await db
      .prepare('INSERT INTO project_updates (id, client_id, project_id, title, content, images, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')
      .bind(updateId, clientId, projectId, title.trim(), content.trim(), images || '[]')
      .run();

    return new Response(JSON.stringify({ success: true, updateId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Create project update API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
