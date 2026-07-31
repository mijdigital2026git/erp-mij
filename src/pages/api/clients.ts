import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'prof') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const queryResult = await db
      .prepare(`
        SELECT u.id, u.name, u.code, u.project_name, u.project_deadline_date, u.project_deadline_time, u.contact, u.project_info, COUNT(t.id) as task_count 
        FROM users u 
        LEFT JOIN tasks t ON u.id = t.client_id 
        WHERE u.role = 'client' 
        GROUP BY u.id
      `)
      .all();

    return new Response(JSON.stringify({ success: true, clients: queryResult.results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch clients API error:', error);
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
    const { name, code, project_name, project_deadline_date, project_deadline_time, contact } = body;

    if (!name || !code) {
      return new Response(JSON.stringify({ error: 'Name and Code are required.' }), { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    // Check if code is already used
    const existing = await db
      .prepare('SELECT id FROM users WHERE code = ?')
      .bind(trimmedCode)
      .first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Access Code is already in use by another user.' }), { status: 400 });
    }

    const newClientId = `client-${Date.now()}`;

    await db
      .prepare(`
        INSERT INTO users (id, code, name, role, project_name, project_deadline_date, project_deadline_time, contact, project_info) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')
      `)
      .bind(
        newClientId, 
        trimmedCode, 
        trimmedName, 
        'client', 
        project_name || '', 
        project_deadline_date || '', 
        project_deadline_time || '', 
        contact || ''
      )
      .run();

    return new Response(JSON.stringify({ success: true, clientId: newClientId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Create client API error:', error);
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
    const { id, name, code, project_name, project_deadline_date, project_deadline_time, contact, project_info } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Client ID is required.' }), { status: 400 });
    }

    // Verify client exists
    const existing = await db
      .prepare('SELECT id FROM users WHERE id = ? AND role = "client"')
      .bind(id)
      .first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404 });
    }

    // Build dynamic update query based on fields provided
    const queryParts = [];
    const bindings = [];

    if (name !== undefined) {
      queryParts.push('name = ?');
      bindings.push(name.trim());
    }
    if (code !== undefined) {
      const trimmedCode = code.trim();
      // Check if code is already used by someone else
      const conflict = await db
        .prepare('SELECT id FROM users WHERE code = ? AND id != ?')
        .bind(trimmedCode, id)
        .first();
      if (conflict) {
        return new Response(JSON.stringify({ error: 'Access Code is already in use by another user.' }), { status: 400 });
      }
      queryParts.push('code = ?');
      bindings.push(trimmedCode);
    }
    if (project_name !== undefined) {
      queryParts.push('project_name = ?');
      bindings.push(project_name);
    }
    if (project_deadline_date !== undefined) {
      queryParts.push('project_deadline_date = ?');
      bindings.push(project_deadline_date);
    }
    if (project_deadline_time !== undefined) {
      queryParts.push('project_deadline_time = ?');
      bindings.push(project_deadline_time);
    }
    if (contact !== undefined) {
      queryParts.push('contact = ?');
      bindings.push(contact);
    }
    if (project_info !== undefined) {
      queryParts.push('project_info = ?');
      bindings.push(project_info);
    }

    if (queryParts.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update.' }), { status: 400 });
    }

    bindings.push(id);
    const query = `UPDATE users SET ${queryParts.join(', ')} WHERE id = ?`;

    await db.prepare(query).bind(...bindings).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Update client API error:', error);
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
      return new Response(JSON.stringify({ error: 'Client ID is required.' }), { status: 400 });
    }

    await db
      .prepare('DELETE FROM users WHERE id = ? AND role = "client"')
      .bind(id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Delete client API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
