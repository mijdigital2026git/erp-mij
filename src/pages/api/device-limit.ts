import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    let limit = 2;
    try {
      const dbUser = await db
        .prepare('SELECT device_limit FROM users WHERE id = ?')
        .bind(user.id)
        .first();
      if (dbUser && dbUser.device_limit !== undefined && dbUser.device_limit !== null) {
        limit = dbUser.device_limit;
      }
    } catch (e) {
      // column doesn't exist yet, return default
    }

    return new Response(JSON.stringify({ success: true, limit }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('GET device-limit error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;
    const user = (context.locals as any).user;

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { limit, code } = await context.request.json();

    if (!limit || isNaN(parseInt(limit)) || parseInt(limit) < 1) {
      return new Response(JSON.stringify({ error: 'Invalid device limit value.' }), { status: 400 });
    }

    if (!code) {
      return new Response(JSON.stringify({ error: 'Please enter your login code to confirm.' }), { status: 400 });
    }

    // Verify user code
    const dbUser = await db
      .prepare('SELECT code FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    if (!dbUser || dbUser.code !== code) {
      return new Response(JSON.stringify({ error: 'Invalid login code. Confirmation failed.' }), { status: 403 });
    }

    try {
      await db
        .prepare('UPDATE users SET device_limit = ? WHERE id = ?')
        .bind(parseInt(limit), user.id)
        .run();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Database column device_limit is missing. Please run database migrations first.' }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, limit: parseInt(limit) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('POST device-limit error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500 });
  }
};
