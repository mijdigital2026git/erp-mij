import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const sessionUser = context.cookies.get('session_user');

    if (!sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const user = JSON.parse(sessionUser.value);
    if (user.role !== 'admin' && user.role !== 'prof') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const queryResult = await db
      .prepare(`
        SELECT u.id, u.name, u.code, COUNT(t.id) as task_count 
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
