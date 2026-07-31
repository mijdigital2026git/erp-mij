import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  const sessionUser = context.cookies.get('session_user');
  if (sessionUser) {
    try {
      const db = (env as any).DB;
      if (db) {
        await db.prepare('DELETE FROM user_sessions WHERE token = ?').bind(sessionUser.value).run();
      }
    } catch (err) {
      console.error('[Logout API] Error deleting session:', err);
    }
  }

  context.cookies.delete('session_user', { path: '/' });
  return context.redirect('/login');
};

// Also support POST for programmatic logouts
export const POST: APIRoute = async (context) => {
  const sessionUser = context.cookies.get('session_user');
  if (sessionUser) {
    try {
      const db = (env as any).DB;
      if (db) {
        await db.prepare('DELETE FROM user_sessions WHERE token = ?').bind(sessionUser.value).run();
      }
    } catch (err) {
      console.error('[Logout API] Error deleting session:', err);
    }
  }

  context.cookies.delete('session_user', { path: '/' });
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
