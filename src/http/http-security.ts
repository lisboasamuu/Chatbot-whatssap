import type { IncomingMessage, ServerResponse } from 'node:http';

export interface HttpSecurityConfig {
  appOrigin: string;
  production: boolean;
}

export function applySecurityHeaders(response: ServerResponse, production: boolean): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (production) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

export function applyCors(request: IncomingMessage, response: ServerResponse, config: HttpSecurityConfig): boolean {
  const origin = request.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).origin === new URL(config.appOrigin).origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Credentials', 'true');
        response.setHeader('Vary', 'Origin');
      }
    } catch { /* invalid origin gets no CORS headers */ }
  }
  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    response.end();
    return true;
  }
  return false;
}
