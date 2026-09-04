import { env } from 'cloudflare:workers';

export function getDb(context?: any): any {
  try {
    if ((env as any) && (env as any).DB) {
      return (env as any).DB;
    }
  } catch (e) {}

  try {
    if (typeof process !== 'undefined' && (process.env as any)?.DB) {
      return (process.env as any).DB;
    }
  } catch (e) {}

  return null;
}
