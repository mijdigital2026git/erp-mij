import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const PATCH: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;
    const { id } = context.params;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'prof') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    if (!id) {
      return new Response(JSON.stringify({ error: 'Project ID is required.' }), { status: 400 });
    }

    const body = await context.request.json();
    const { name, deadline_date, deadline_time, contact, description, images } = body;

    const queryParts = [];
    const bindings = [];

    if (name !== undefined) {
      queryParts.push('name = ?');
      bindings.push(name.trim());
    }
    if (deadline_date !== undefined) {
      queryParts.push('deadline_date = ?');
      bindings.push(deadline_date);
    }
    if (deadline_time !== undefined) {
      queryParts.push('deadline_time = ?');
      bindings.push(deadline_time);
    }
    if (contact !== undefined) {
      queryParts.push('contact = ?');
      bindings.push(contact);
    }
    if (description !== undefined) {
      queryParts.push('description = ?');
      bindings.push(description);
    }
    if (images !== undefined) {
      queryParts.push('image_url = ?');
      bindings.push(images);
    }

    if (queryParts.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update.' }), { status: 400 });
    }

    queryParts.push('updated_at = CURRENT_TIMESTAMP');
    bindings.push(id);

    const query = `UPDATE projects SET ${queryParts.join(', ')} WHERE id = ?`;
    await db.prepare(query).bind(...bindings).run();

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
    const { id } = context.params;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'prof') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    if (!id) {
      return new Response(JSON.stringify({ error: 'Project ID is required.' }), { status: 400 });
    }

    await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Delete project API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
