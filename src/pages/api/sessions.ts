import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const queryResult = await db
      .prepare(`
        SELECT id, token, created_at, updated_at 
        FROM user_sessions 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
      `)
      .bind(user.id)
      .all();

    return new Response(JSON.stringify({ success: true, sessions: queryResult.results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch sessions error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;
    const sessionUser = context.cookies.get('session_user');

    if (!user || !sessionUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Delete all sessions for this user EXCEPT the current session token
    await db
      .prepare('DELETE FROM user_sessions WHERE user_id = ? AND token != ?')
      .bind(user.id, sessionUser.value)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Delete sessions error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
