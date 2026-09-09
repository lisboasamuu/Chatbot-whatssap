export interface CompanyCredentialRecord {
  id: string;
  companyId: string;
  email: string;
  passwordHash: string;
  company: {
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
    timezone: string;
  };
}

export interface CompanySessionRecord {
  id: string;
  tokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  credential: CompanyCredentialRecord;
}

export interface CompanyAuthRepository {
  findCredentialByEmail(email: string): Promise<CompanyCredentialRecord | null>;
  findSessionByTokenHash(tokenHash: string): Promise<CompanySessionRecord | null>;
  createSession(credentialId: string, tokenHash: string, now: Date, expiresAt: Date): Promise<void>;
  touchSession(sessionId: string, lastSeenAt: Date): Promise<void>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteSessionById(sessionId: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
}
