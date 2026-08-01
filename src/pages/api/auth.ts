import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async (context) => {
  try {
    const db = (env as any).DB;

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

    // Clean up expired sessions (older than 7 days)
    await db.prepare("DELETE FROM user_sessions WHERE updated_at < datetime('now', '-7 days')").run();

    // Check device limit (max 2 active sessions per user)
    const activeSessions = await db
      .prepare("SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ?")
      .bind(user.id)
      .first();

    const sessionCount = activeSessions ? (activeSessions.count as number) : 0;
    
    if (sessionCount >= 2) {
      // Auto-kick the oldest sessions, leaving only 1 slot open for the new device session
      const sessionsToDelete = sessionCount - 1;
      await db.prepare(`
        DELETE FROM user_sessions 
        WHERE token IN (
          SELECT token FROM user_sessions 
          WHERE user_id = ? 
          ORDER BY updated_at ASC 
          LIMIT ?
        )
      `)
      .bind(user.id, sessionsToDelete)
      .run();
      
      console.log(`[Auth API] Device limit reached. Auto-kicked ${sessionsToDelete} oldest session(s) for user: ${user.name}`);
    }

    // Generate unique session token
    const sessionToken = 'token-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    
    // Save session in D1
    await db.prepare('INSERT INTO user_sessions (id, user_id, token) VALUES (?, ?, ?)')
      .bind(sessionToken, user.id, sessionToken)
      .run();

    const isSecure = context.request.url.startsWith('https');
    console.log(`[Auth API] Logged in user: ${user.name}, Active devices: ${sessionCount + 1}/2`);

    const cookieName = user.role === 'client' ? 'session_user_client' : 'session_user_admin';

    context.cookies.set(cookieName, sessionToken, {
      path: '/',
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    const redirectRole = user.role === 'admin' ? 'dashboard' : (user.role === 'client' ? 'client' : user.role);
    return new Response(JSON.stringify({ success: true, role: redirectRole }), {
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
