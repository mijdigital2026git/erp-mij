import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const sessionUser = context.cookies.get('session_user');

    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const currentUser = JSON.parse(sessionUser.value);
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
