import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const PATCH: APIRoute = async (context) => {
  try {
    const { id } = context.params;
    const db = (env as any).DB;
    const currentUser = (context.locals as any).user;

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (currentUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can manage users.' }), { status: 403 });
    }

    const { name, role, code } = await context.request.json();
    if (!name || name.trim() === '' || !role || !code || code.trim() === '') {
      return new Response(JSON.stringify({ error: 'Name, Role, and Code are required.' }), { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    const trimmedCode = code.trim();

    if (trimmedRole !== 'admin' && trimmedRole !== 'prof' && trimmedRole !== 'client') {
      return new Response(JSON.stringify({ error: 'Invalid role.' }), { status: 400 });
    }

    // Check if the code is already used by another user
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE code = ? AND id != ?')
      .bind(trimmedCode, id)
      .first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'This access code is already in use by another user.' }), { status: 400 });
    }

    // Update in database
    await db
      .prepare('UPDATE users SET name = ?, role = ?, code = ? WHERE id = ?')
      .bind(trimmedName, trimmedRole, trimmedCode, id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Update user API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const { id } = context.params;
    const db = (env as any).DB;
    const currentUser = (context.locals as any).user;

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (currentUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can manage users.' }), { status: 403 });
    }

    if (currentUser.id === id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account.' }), { status: 400 });
    }

    await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Delete user API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
