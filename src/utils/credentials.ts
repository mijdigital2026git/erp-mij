interface Credentials {
  clientEmail: string;
  privateKey: string;
}

/**
 * Loads Google Service Account credentials.
 * Checks the provided runtime environment object first, then environment variables, then local JSON file.
 */
export async function getGoogleCredentials(runtimeEnv?: Record<string, any>): Promise<Credentials> {
  // 1. Try to load from runtime environment variables (Cloudflare Pages/Workers runtime)
  const clientEmail = runtimeEnv?.GOOGLE_CLIENT_EMAIL || (typeof process !== 'undefined' ? process.env.GOOGLE_CLIENT_EMAIL : undefined);
  const privateKey = runtimeEnv?.GOOGLE_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env.GOOGLE_PRIVATE_KEY : undefined);

  if (clientEmail && privateKey) {
    return {
      clientEmail,
      // Replace escaped newlines if the key was set as a single-line string with "\n"
      privateKey: privateKey.replace(/\\n/g, '\n')
    };
  }

  // 2. Try to load from local file for development using dynamic imports (only in Node.js / dev server)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const credsPath = path.resolve(process.cwd(), 'credentials/google-credentials.json');
      if (fs.existsSync(credsPath)) {
        const fileContent = fs.readFileSync(credsPath, 'utf-8');
        const data = JSON.parse(fileContent);
        if (data.client_email && data.private_key) {
          return {
            clientEmail: data.client_email,
            privateKey: data.private_key
          };
        }
      }
    } catch (error) {
      console.warn('Could not read credentials from file, falling back...', error);
    }
  }

  throw new Error('Google Service Account credentials not found. Please set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY or provide credentials/google-credentials.json.');
}
