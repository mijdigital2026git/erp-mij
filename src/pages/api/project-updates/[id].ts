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
      return new Response(JSON.stringify({ error: 'Update ID is required.' }), { status: 400 });
    }

    const body = await context.request.json();
    const { title, content, images } = body;

    const queryParts = [];
    const bindings = [];

    if (title !== undefined) {
      queryParts.push('title = ?');
      bindings.push(title.trim());
    }
    if (content !== undefined) {
      queryParts.push('content = ?');
      bindings.push(content.trim());
    }
    if (images !== undefined) {
      queryParts.push('images = ?');
      bindings.push(images);
    }

    if (queryParts.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update.' }), { status: 400 });
    }

    queryParts.push('updated_at = CURRENT_TIMESTAMP');
    bindings.push(id);

    const query = `UPDATE project_updates SET ${queryParts.join(', ')} WHERE id = ?`;
    await db.prepare(query).bind(...bindings).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Update project update API error:', error);
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
      return new Response(JSON.stringify({ error: 'Update ID is required.' }), { status: 400 });
    }

    await db
      .prepare('DELETE FROM project_updates WHERE id = ?')
      .bind(id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Delete project update API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
