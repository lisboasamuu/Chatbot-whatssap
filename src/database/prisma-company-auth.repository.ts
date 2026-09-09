import type { PrismaClient } from '@prisma/client';
import type {
  CompanyAuthRepository,
  CompanyCredentialRecord,
  CompanySessionRecord,
} from '../company-auth/company-auth.repository.js';

const credentialSelect = {
  id: true,
  companyId: true,
  email: true,
  passwordHash: true,
  company: { select: { id: true, name: true, status: true, timezone: true } },
} as const;

export class PrismaCompanyAuthRepository implements CompanyAuthRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public findCredentialByEmail(email: string): Promise<CompanyCredentialRecord | null> {
    return this.prisma.companyCredential.findUnique({ where: { email }, select: credentialSelect }) as Promise<CompanyCredentialRecord | null>;
  }

  public findSessionByTokenHash(tokenHash: string): Promise<CompanySessionRecord | null> {
    return this.prisma.companySession.findUnique({
      where: { tokenHash },
      select: {
        id: true, tokenHash: true, createdAt: true, lastSeenAt: true, expiresAt: true,
        credential: { select: credentialSelect },
      },
    }) as Promise<CompanySessionRecord | null>;
  }

  public async createSession(credentialId: string, tokenHash: string, now: Date, expiresAt: Date): Promise<void> {
    await this.prisma.companySession.create({ data: { credentialId, tokenHash, createdAt: now, lastSeenAt: now, expiresAt } });
  }
  public async touchSession(sessionId: string, lastSeenAt: Date): Promise<void> {
    await this.prisma.companySession.update({ where: { id: sessionId }, data: { lastSeenAt } });
  }
  public async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.companySession.deleteMany({ where: { tokenHash } });
  }
  public async deleteSessionById(sessionId: string): Promise<void> {
    await this.prisma.companySession.deleteMany({ where: { id: sessionId } });
  }
  public async deleteExpiredSessions(now: Date): Promise<void> {
    await this.prisma.companySession.deleteMany({ where: { expiresAt: { lte: now } } });
  }
}
