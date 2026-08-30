import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const IDLE_TTL_MS = 30 * 60 * 1000;
const ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

interface Session { createdAt: number; lastSeenAt: number; }
interface Attempts { count: number; windowStartedAt: number; }

function hash(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
function parseCookies(request: IncomingMessage): Record<string,string> {
  const result:Record<string,string>={};
  for (const piece of (request.headers.cookie ?? '').split(';')) {
    const [rawKey,...rest]=piece.trim().split('=');
    if (!rawKey) continue;
    result[rawKey]=decodeURIComponent(rest.join('='));
  }
  return result;
}
function clientKey(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? 'unknown';
}

export class PlatformAdminAuth {
  private readonly sessions = new Map<string, Session>();
  private readonly attempts = new Map<string, Attempts>();

  public constructor(private readonly password: string, private readonly production: boolean) {
    if (password.length < 16) throw new Error('PLATFORM_ADMIN_PASSWORD must have at least 16 characters.');
  }

  public verifyPassword(candidate: string, request: IncomingMessage): boolean {
    const key=clientKey(request), now=Date.now(), current=this.attempts.get(key);
    const attempt=!current || now-current.windowStartedAt >= LOGIN_WINDOW_MS
      ? {count:0,windowStartedAt:now} : current;
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) return false;
    const ok=timingSafeEqual(hash(candidate),hash(this.password));
    if (ok) this.attempts.delete(key);
    else { attempt.count += 1; this.attempts.set(key,attempt); }
    return ok;
  }

  public createSession(response: ServerResponse): void {
    const token=randomBytes(32).toString('base64url');
    const now=Date.now();
    this.sessions.set(token,{createdAt:now,lastSeenAt:now});
    const secure=this.production ? '; Secure' : '';
    response.setHeader('Set-Cookie',`st_platform_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(ABSOLUTE_TTL_MS/1000)}${secure}`);
  }

  public clearSession(request: IncomingMessage,response:ServerResponse):void {
    const token=parseCookies(request).st_platform_session;
    if (token) this.sessions.delete(token);
    const secure=this.production ? '; Secure' : '';
    response.setHeader('Set-Cookie',`st_platform_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
  }

  public isAuthenticated(request:IncomingMessage):boolean {
    const token=parseCookies(request).st_platform_session;
    if (!token) return false;
    const session=this.sessions.get(token);
    if (!session) return false;
    const now=Date.now();
    if (now-session.lastSeenAt > IDLE_TTL_MS || now-session.createdAt > ABSOLUTE_TTL_MS) {
      this.sessions.delete(token); return false;
    }
    session.lastSeenAt=now;
    return true;
  }

  public isSameOrigin(request:IncomingMessage):boolean {
    const origin=request.headers.origin;
    if (!origin) return true; // non-browser clients still require the session cookie
    const host=request.headers.host;
    if (!host) return false;
    try {
      const parsed=new URL(origin);
      const expectedProtocol=this.production ? 'https:' : parsed.protocol;
      return parsed.host===host && parsed.protocol===expectedProtocol;
    } catch { return false; }
  }
}
