import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  context.cookies.delete('session_user', { path: '/' });
  return context.redirect('/login');
};

// Also support POST for programmatic logouts
export const POST: APIRoute = async (context) => {
  context.cookies.delete('session_user', { path: '/' });
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
