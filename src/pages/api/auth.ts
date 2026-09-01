import type { APIRoute } from 'astro';
import { getDb } from '../../utils/getDb';

export const POST: APIRoute = async (context) => {
  try {
    const db = getDb(context);

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

    // Query D1 database for the user with the given code (case-insensitive)
    let user = null;
    let deviceLimit = 2;
    try {
      user = await db
        .prepare('SELECT id, name, role, device_limit FROM users WHERE LOWER(code) = LOWER(?)')
        .bind(code)
        .first();
      if (user && user.device_limit !== undefined && user.device_limit !== null) {
        deviceLimit = parseInt(user.device_limit) || 2;
      }
    } catch (e) {
      // Fallback if migration hasn't been run yet
      user = await db
        .prepare('SELECT id, name, role FROM users WHERE LOWER(code) = LOWER(?)')
        .bind(code)
        .first();
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid login code. Please try again.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clean up expired sessions (older than 7 days)
    await db.prepare("DELETE FROM user_sessions WHERE updated_at < datetime('now', '-7 days')").run();

    // Check device limit (max dynamic active sessions per user)
    const activeSessions = await db
      .prepare("SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ?")
      .bind(user.id)
      .first();

    const sessionCount = activeSessions ? (activeSessions.count as number) : 0;
    
    if (sessionCount >= deviceLimit) {
      // Auto-kick the oldest sessions, leaving only 1 slot open for the new device session
      const sessionsToDelete = sessionCount - deviceLimit + 1;
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
      
      console.log(`[Auth API] Device limit reached. Auto-kicked ${sessionsToDelete} oldest session(s) for user: ${user.name}. Device limit was: ${deviceLimit}`);
    }

    // Extract user agent to detect device name
    const userAgent = context.request.headers.get('user-agent') || 'Unknown Device';
    let deviceName = 'Desktop PC';
    const ua = userAgent.toLowerCase();
    if (ua.includes('iphone')) {
      deviceName = 'iPhone';
    } else if (ua.includes('ipad')) {
      deviceName = 'iPad';
    } else if (ua.includes('android')) {
      if (ua.includes('mobile')) {
        deviceName = 'Android Phone';
      } else {
        deviceName = 'Android Tablet';
      }
    } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
      deviceName = 'MacBook/Mac';
    } else if (ua.includes('windows')) {
      deviceName = 'Windows PC';
    } else if (ua.includes('linux')) {
      deviceName = 'Linux PC';
    }

    // Generate unique session token and session ID containing device name
    const sessionToken = 'token-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
    const sessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10) + '@@' + deviceName;
    
    // Save session in D1
    await db.prepare('INSERT INTO user_sessions (id, user_id, token) VALUES (?, ?, ?)')
      .bind(sessionId, user.id, sessionToken)
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
