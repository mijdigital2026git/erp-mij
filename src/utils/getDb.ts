import { env } from 'cloudflare:workers';

export function getDb(context?: any): any {
  try {
    if ((env as any) && (env as any).DB) {
      return (env as any).DB;
    }
  } catch (e) {}

  try {
    if (context?.locals?.env?.DB) {
      return context.locals.env.DB;
    }
    if (context?.locals?.DB) {
      return context.locals.DB;
    }
  } catch (e) {}

  return null;
}
