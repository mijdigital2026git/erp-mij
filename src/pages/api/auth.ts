import type { APIRoute } from 'astro';

export const POST: APIRoute = async (context) => {
  try {
    const runtime = (context.locals as any).runtime;
    const db = runtime?.env?.DB;

    if (!db) {
      return new Response(JSON.stringify({ error: 'Database binding (DB) not found in Cloudflare runtime environment.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { code } = await context.request.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'Please enter a login code.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query D1 database for the user with the given code
    const user = await db
      .prepare('SELECT id, name, role FROM users WHERE code = ?')
      .bind(code)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid login code. Please try again.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set a session cookie containing user info
    // In production, you would encrypt this, but for this implementation we store it as JSON string
    const sessionData = JSON.stringify({
      id: user.id,
      name: user.name,
      role: user.role
    });

    context.cookies.set('session_user', sessionData, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return new Response(JSON.stringify({ success: true, role: user.role }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Auth API error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
