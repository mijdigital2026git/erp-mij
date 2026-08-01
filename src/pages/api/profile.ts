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
      .prepare('SELECT id, name, role, code, project_name, project_deadline_date, project_deadline_time, contact, project_info, project_image_url FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    if (!userData) {
      return new Response(JSON.stringify({ error: 'User profile not found.' }), { status: 404 });
    }

    let projects: any[] = [];
    if (userData.role === 'client') {
      const projResult = await db
        .prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at ASC')
        .bind(user.id)
        .all();
      projects = projResult.results;
    }

    return new Response(JSON.stringify({ success: true, profile: userData, projects }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Fetch profile API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
