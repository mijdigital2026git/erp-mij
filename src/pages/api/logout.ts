import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

async function performLogout(context: any) {
  const clientSession = context.cookies.get('session_user_client');
  const adminSession = context.cookies.get('session_user_admin');
  const legacySession = context.cookies.get('session_user');

  const tokens = [
    clientSession?.value,
    adminSession?.value,
    legacySession?.value
  ].filter(Boolean);

  if (tokens.length > 0) {
    try {
      const db = (env as any).DB;
      if (db) {
        for (const token of tokens) {
          await db.prepare('DELETE FROM user_sessions WHERE token = ?').bind(token).run();
        }
      }
    } catch (err) {
      console.error('[Logout API] Error deleting sessions:', err);
    }
  }

  context.cookies.delete('session_user_client', { path: '/' });
  context.cookies.delete('session_user_admin', { path: '/' });
  context.cookies.delete('session_user', { path: '/' });
}

export const GET: APIRoute = async (context) => {
  await performLogout(context);
  return context.redirect('/login');
};

// Also support POST for programmatic logouts
export const POST: APIRoute = async (context) => {
  await performLogout(context);
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
