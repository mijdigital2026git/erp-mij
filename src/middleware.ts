import { defineMiddleware } from "astro:middleware";
import { env } from 'cloudflare:workers';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const referer = context.request.headers.get('referer') || '';
  const isClientContext = url.pathname.startsWith('/client') || referer.includes('/client');
  
  // Decide which session cookie to read
  const cookieName = isClientContext ? 'session_user_client' : 'session_user_admin';
  let sessionCookie = context.cookies.get(cookieName);
  
  // Fallback to legacy cookie if specific one is not found
  if (!sessionCookie) {
    sessionCookie = context.cookies.get('session_user');
  }

  let user = null;
  console.log(`[Middleware] Path: ${url.pathname}, Context: ${isClientContext ? 'client' : 'admin'}, Cookie Name: ${cookieName}, Session Cookie Raw:`, sessionCookie ? sessionCookie.value : 'not found');

  if (sessionCookie) {
    try {
      const db = (env as any).DB;
      if (db) {
        // Query the D1 database for the session and user info
        const sessionRecord = await db
          .prepare(`
            SELECT u.id, u.name, u.role 
            FROM user_sessions s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.token = ? AND s.updated_at > datetime('now', '-7 days')
          `)
          .bind(sessionCookie.value)
          .first();

        if (sessionRecord) {
          user = {
            id: sessionRecord.id,
            name: sessionRecord.name,
            role: sessionRecord.role
          };
          (context.locals as any).user = user;
          console.log(`[Middleware] Resolved active user session:`, user.name, 'with role:', user.role);

          // Update session timestamp to keep it alive
          await db
            .prepare("UPDATE user_sessions SET updated_at = CURRENT_TIMESTAMP WHERE token = ?")
            .bind(sessionCookie.value)
            .run();
        } else {
          console.log(`[Middleware] Invalid or expired session token, deleting cookie`);
          context.cookies.delete(cookieName, { path: '/' });
          context.cookies.delete('session_user', { path: '/' });
        }
      }
    } catch (err: any) {
      console.error('[Middleware] Session resolution error:', err.message);
      context.cookies.delete(cookieName, { path: '/' });
      context.cookies.delete('session_user', { path: '/' });
    }
  }

  // 1. Guard Client Dashboard
  if (url.pathname === '/client' || url.pathname.startsWith('/client/')) {
    if (!user || user.role !== 'client') {
      return context.redirect('/login');
    }
  }

  // 2. Guard Professional Dashboard
  if (url.pathname.startsWith('/prof')) {
    if (!user || user.role !== 'prof') {
      return context.redirect('/login');
    }
  }

  // 3. Guard Admin Dashboard & User Management
  if (url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/client')) {
    if (!user || user.role !== 'admin') {
      return context.redirect('/login');
    }
  }

  if (url.pathname.startsWith('/users')) {
    if (!user || user.role !== 'admin') {
      return context.redirect('/login');
    }
  }

  // 4. Redirect logged-in users away from the login page
  if (url.pathname === '/login') {
    // Only redirect if there's no ?code=... param which overrides existing logins
    if (user && !url.searchParams.has('code')) {
      const redirectPath = user.role === 'admin' ? 'dashboard' : (user.role === 'client' ? 'client' : user.role);
      return context.redirect(`/${redirectPath}`);
    }
  }

  return next();
});
