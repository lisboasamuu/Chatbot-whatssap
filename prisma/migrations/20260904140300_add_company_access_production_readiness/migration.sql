-- Fase 7.5 - Company Access / Production Readiness
ALTER TABLE "CompanySettings"
ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CompanyCredential" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanySession" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyCredential_companyId_key" ON "CompanyCredential"("companyId");
CREATE UNIQUE INDEX "CompanyCredential_email_key" ON "CompanyCredential"("email");
CREATE INDEX "CompanyCredential_companyId_idx" ON "CompanyCredential"("companyId");
CREATE UNIQUE INDEX "CompanySession_tokenHash_key" ON "CompanySession"("tokenHash");
CREATE INDEX "CompanySession_credentialId_expiresAt_idx" ON "CompanySession"("credentialId", "expiresAt");
CREATE INDEX "CompanySession_expiresAt_idx" ON "CompanySession"("expiresAt");

ALTER TABLE "CompanyCredential"
ADD CONSTRAINT "CompanyCredential_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanySession"
ADD CONSTRAINT "CompanySession_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "CompanyCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
