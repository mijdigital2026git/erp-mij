import { env } from 'cloudflare:workers';

export function getDb(context?: any): any {
  try {
    if ((env as any) && (env as any).DB) {
      return (env as any).DB;
    }
  } catch (e) {
    // Ignore error if env import is not present in dev
  }

  try {
    if ((context?.locals as any)?.runtime?.env?.DB) {
      return (context.locals as any).runtime.env.DB;
    }
  } catch (e) {
    // Ignore Astro v6 deprecation warning
  }

  return null;
}
