import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionUser = context.cookies.get('session_user');
  let user = null;

  if (sessionUser) {
    try {
      user = JSON.parse(sessionUser.value);
      // Assign parsed user to Astro context locals for access inside pages
      (context.locals as any).user = user;
    } catch {
      // Clear malformed cookie
      context.cookies.delete('session_user', { path: '/' });
    }
  }

  const url = new URL(context.request.url);

  // 1. Guard Client Dashboard
  if (url.pathname.startsWith('/client')) {
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

  // 3. Guard Admin Dashboard
  if (url.pathname.startsWith('/admin')) {
    if (!user || user.role !== 'admin') {
      return context.redirect('/login');
    }
  }

  // 4. Redirect logged-in users away from the login page
  if (url.pathname === '/login') {
    if (user) {
      return context.redirect(`/${user.role}`);
    }
  }

  return next();
});
