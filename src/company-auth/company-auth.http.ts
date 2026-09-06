import type { IncomingMessage, ServerResponse } from 'node:http';
import { CompanyAuthService, CompanyInactiveError, type AuthenticatedCompany } from './company-auth.service.js';

const COOKIE_NAME = 'st_company_session';
const ABSOLUTE_TTL_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

interface Attempts { count: number; windowStartedAt: number; }

function parseCookies(request: IncomingMessage): Record<string, string> {
  const result: Record<string, string> = {};
  for (const piece of (request.headers.cookie ?? '').split(';')) {
    const [rawKey, ...rest] = piece.trim().split('=');
    if (!rawKey) continue;
    try { result[rawKey] = decodeURIComponent(rest.join('=')); } catch { /* ignore malformed cookie */ }
  }
  return result;
}

export class CompanyHttpAuth {
  private readonly attempts = new Map<string, Attempts>();

  public constructor(
    private readonly service: CompanyAuthService,
    private readonly production: boolean,
    private readonly appOrigin: string,
    private readonly trustProxy: boolean,
  ) {}

  public isSameOrigin(request: IncomingMessage): boolean {
    const origin = request.headers.origin;
    if (!origin) return true;
    try { return new URL(origin).origin === new URL(this.appOrigin).origin; } catch { return false; }
  }

  public canAttemptLogin(request: IncomingMessage): boolean {
    const key = this.clientKey(request), now = Date.now(), current = this.attempts.get(key);
    const attempt = !current || now - current.windowStartedAt >= LOGIN_WINDOW_MS
      ? { count: 0, windowStartedAt: now } : current;
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) return false;
    return true;
  }

  public recordLoginFailure(request: IncomingMessage): void {
    const key = this.clientKey(request), now = Date.now(), current = this.attempts.get(key);
    const attempt = !current || now - current.windowStartedAt >= LOGIN_WINDOW_MS
      ? { count: 0, windowStartedAt: now } : current;
    attempt.count += 1;
    this.attempts.set(key, attempt);
  }

  public clearLoginFailures(request: IncomingMessage): void {
    this.attempts.delete(this.clientKey(request));
  }

  public async createSession(email: string, password: string, response: ServerResponse): Promise<AuthenticatedCompany> {
    const result = await this.service.login(email, password);
    const secure = this.production ? '; Secure' : '';
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(result.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ABSOLUTE_TTL_SECONDS}${secure}`);
    return result.company;
  }

  public async authenticate(request: IncomingMessage): Promise<AuthenticatedCompany | null> {
    return this.service.authenticate(parseCookies(request)[COOKIE_NAME]);
  }

  public async clearSession(request: IncomingMessage, response: ServerResponse): Promise<void> {
    await this.service.logout(parseCookies(request)[COOKIE_NAME]);
    const secure = this.production ? '; Secure' : '';
    response.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
  }

  public isInactiveError(error: unknown): boolean { return error instanceof CompanyInactiveError; }

  private clientKey(request: IncomingMessage): string {
    if (this.trustProxy) {
      const forwarded = request.headers['x-forwarded-for'];
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
      if (first?.trim()) return first.trim();
    }
    return request.socket.remoteAddress ?? 'unknown';
  }
}
