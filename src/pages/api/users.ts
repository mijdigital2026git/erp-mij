import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const currentUser = (context.locals as any).user;

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (currentUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const queryResult = await db
      .prepare('SELECT id, name, role, code FROM users ORDER BY role ASC, name ASC')
      .all();

    return new Response(JSON.stringify({ success: true, users: queryResult.results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch users API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const currentUser = (context.locals as any).user;

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    if (currentUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create users.' }), { status: 403 });
    }

    const { name, role, code } = await context.request.json();

    if (!name || !role || !code) {
      return new Response(JSON.stringify({ error: 'Name, Role, and Code are required.' }), { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    const trimmedCode = code.trim();

    if (trimmedRole !== 'admin' && trimmedRole !== 'prof' && trimmedRole !== 'client') {
      return new Response(JSON.stringify({ error: 'Invalid role.' }), { status: 400 });
    }

    // Check if code is already used
    const existing = await db
      .prepare('SELECT id FROM users WHERE code = ?')
      .bind(trimmedCode)
      .first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Access Code is already in use by another user.' }), { status: 400 });
    }

    const newUserId = `${trimmedRole}-${Date.now()}`;

    await db
      .prepare('INSERT INTO users (id, code, name, role) VALUES (?, ?, ?, ?)')
      .bind(newUserId, trimmedCode, trimmedName, trimmedRole)
      .run();

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Create user API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
