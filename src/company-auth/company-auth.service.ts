import { createHmac, randomBytes } from 'node:crypto';
import type { CompanyAuthRepository } from './company-auth.repository.js';
import { verifyPassword } from './password.js';

const IDLE_TTL_MS = 30 * 60 * 1000;
const ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;

export interface AuthenticatedCompany {
  credentialId: string;
  companyId: string;
  companyName: string;
  timezone: string;
  email: string;
}

export class InvalidCompanyCredentialsError extends Error {}
export class CompanyInactiveError extends Error {}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export class CompanyAuthService {
  public constructor(
    private readonly repository: CompanyAuthRepository,
    private readonly sessionSecret: string,
    private readonly clock: () => Date = () => new Date(),
  ) {
    if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must have at least 32 characters.');
  }

  private tokenHash(token: string): string {
    return createHmac('sha256', this.sessionSecret).update(token, 'utf8').digest('base64url');
  }

  public async login(email: string, password: string): Promise<{ token: string; company: AuthenticatedCompany }> {
    const normalized = normalizeEmail(email);
    const credential = normalized ? await this.repository.findCredentialByEmail(normalized) : null;
    if (!credential || !(await verifyPassword(password, credential.passwordHash))) {
      throw new InvalidCompanyCredentialsError('Credenciais inválidas.');
    }
    if (credential.company.status !== 'ACTIVE') {
      throw new CompanyInactiveError('Empresa inativa.');
    }

    const token = randomBytes(32).toString('base64url');
    const now = this.clock();
    await this.repository.createSession(
      credential.id,
      this.tokenHash(token),
      now,
      new Date(now.getTime() + ABSOLUTE_TTL_MS),
    );
    return { token, company: this.toContext(credential) };
  }

  public async authenticate(token: string | undefined): Promise<AuthenticatedCompany | null> {
    if (!token) return null;
    const now = this.clock();
    const hash = this.tokenHash(token);
    const session = await this.repository.findSessionByTokenHash(hash);
    if (!session) return null;
    if (session.expiresAt <= now || now.getTime() - session.lastSeenAt.getTime() > IDLE_TTL_MS) {
      await this.repository.deleteSessionById(session.id);
      return null;
    }
    if (session.credential.company.status !== 'ACTIVE') {
      await this.repository.deleteSessionById(session.id);
      throw new CompanyInactiveError('Empresa inativa.');
    }
    await this.repository.touchSession(session.id, now);
    return this.toContext(session.credential);
  }

  public async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.repository.deleteSessionByTokenHash(this.tokenHash(token));
  }

  public cleanupExpired(): Promise<void> {
    return this.repository.deleteExpiredSessions(this.clock());
  }

  private toContext(credential: { id: string; companyId: string; email: string; company: { id: string; name: string; timezone: string } }): AuthenticatedCompany {
    return {
      credentialId: credential.id,
      companyId: credential.companyId,
      companyName: credential.company.name,
      timezone: credential.company.timezone,
      email: credential.email,
    };
  }
}
