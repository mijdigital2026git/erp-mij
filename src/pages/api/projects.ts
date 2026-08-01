import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    let query;
    let bindings: any[] = [];

    if (user.role === 'client') {
      query = 'SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC';
      bindings.push(user.id);
    } else {
      // Admin/prof can filter by clientId or get all
      const url = new URL(context.request.url);
      const clientId = url.searchParams.get('clientId');
      if (clientId) {
        query = 'SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC';
        bindings.push(clientId);
      } else {
        query = 'SELECT * FROM projects ORDER BY created_at DESC';
      }
    }

    const queryResult = await db.prepare(query).bind(...bindings).all();

    return new Response(JSON.stringify({ success: true, projects: queryResult.results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch projects API error:', error);
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
    const { clientId, name, deadline_date, deadline_time, contact, description, images } = body;

    if (!clientId || !name) {
      return new Response(JSON.stringify({ error: 'Client ID and Project Name are required.' }), { status: 400 });
    }

    const projectId = `project-${Date.now()}`;

    await db
      .prepare(`
        INSERT INTO projects (id, client_id, name, deadline_date, deadline_time, contact, description, image_url, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(
        projectId,
        clientId,
        name.trim(),
        deadline_date || '',
        deadline_time || '',
        contact || '',
        description || '',
        images || '[]'
      )
      .run();

    return new Response(JSON.stringify({ success: true, projectId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Create project API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

export const PATCH: APIRoute = async (context) => {
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
    const { id, name, deadline_date, deadline_time, contact, description } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Project ID is required.' }), { status: 400 });
    }

    const existing = await db.prepare('SELECT id FROM projects WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Project not found.' }), { status: 404 });
    }

    await db
      .prepare(`
        UPDATE projects 
        SET name = ?, deadline_date = ?, deadline_time = ?, contact = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `)
      .bind(
        name ? name.trim() : '',
        deadline_date || '',
        deadline_time || '',
        contact || '',
        description || '',
        id
      )
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Update project API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
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
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Project ID is required.' }), { status: 400 });
    }

    const existing = await db.prepare('SELECT id FROM projects WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Project not found.' }), { status: 404 });
    }

    await db.batch([
      db.prepare('DELETE FROM tasks WHERE project_id = ?').bind(id),
      db.prepare('DELETE FROM projects WHERE id = ?').bind(id)
    ]);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Delete project API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
