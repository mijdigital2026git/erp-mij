import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const userData = await db
      .prepare('SELECT id, name, role, code, project_name, project_deadline_date, project_deadline_time, contact, project_info FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    if (!userData) {
      return new Response(JSON.stringify({ error: 'User profile not found.' }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true, profile: userData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch profile API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
