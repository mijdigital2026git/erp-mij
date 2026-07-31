import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const PATCH: APIRoute = async (context) => {
  try {
    const { id } = context.params;
    const db = (env as any).DB;
    const sessionUser = context.cookies.get('session_user');

    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const currentUser = JSON.parse(sessionUser.value);
    if (currentUser.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can manage access codes.' }), { status: 403 });
    }

    const { code } = await context.request.json();
    if (!code || code.trim() === '') {
      return new Response(JSON.stringify({ error: 'Access code cannot be empty.' }), { status: 400 });
    }

    // Check if the code is already used by another user
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE code = ? AND id != ?')
      .bind(code.trim(), id)
      .first();

    if (existingUser) {
      return new Response(JSON.stringify({ error: 'This access code is already in use by another user.' }), { status: 400 });
    }

    // Update the code in database
    await db
      .prepare('UPDATE users SET code = ? WHERE id = ?')
      .bind(code.trim(), id)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Update user code API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
