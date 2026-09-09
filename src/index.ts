import { AdminService } from './admin/admin.service.js';
import { createAdminHttpServer } from './admin/admin.http.js';
import { CompanyHttpAuth } from './company-auth/company-auth.http.js';
import { CompanyAuthService } from './company-auth/company-auth.service.js';
import { PrismaAdminRepository } from './database/prisma-admin.repository.js';
import { PrismaCompanyAuthRepository } from './database/prisma-company-auth.repository.js';
import { PrismaPlatformAdminRepository } from './database/prisma-platform-admin.repository.js';
import { connectDatabase, disconnectDatabase, prisma } from './database/prisma.client.js';
import { PlatformAdminAuth } from './platform-admin/platform-admin.auth.js';
import { PlatformAdminService } from './platform-admin/platform-admin.service.js';
import { CompanyRuntimeManager } from './runtime/company-runtime.manager.js';

const DEFAULT_HTTP_PORT = 3001;

function envPort(): number {
  const raw = process.env.PORT?.trim() || process.env.ADMIN_HTTP_PORT?.trim();
  if (!raw) return DEFAULT_HTTP_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  return port;
}
function requiredSecret(name: 'PLATFORM_ADMIN_PASSWORD' | 'SESSION_SECRET', minimum: number): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  if (value.length < minimum) throw new Error(`${name} must have at least ${minimum} characters.`);
  return value;
}
function boolEnv(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`${name} must be true or false.`);
}

async function main(): Promise<void> {
  let server: ReturnType<typeof createAdminHttpServer> | null = null;
  let runtimeManager: CompanyRuntimeManager | null = null;
  let cleanupTimer: NodeJS.Timeout | null = null;
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[App] Sinal ${signal} recebido. Encerrando aplicação...`);
    if (cleanupTimer) clearInterval(cleanupTimer);
    await new Promise<void>((resolve) => {
      if (!server?.listening) { resolve(); return; }
      server.close((error) => { if (error) { console.error('[HTTP] Erro ao encerrar servidor.'); process.exitCode = 1; } resolve(); });
    });
    if (runtimeManager) await runtimeManager.stop();
    try { await disconnectDatabase(); } catch { console.error('[Database] Erro ao desconectar PostgreSQL.'); process.exitCode = 1; }
  };

  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

  try {
    const production = process.env.NODE_ENV === 'production';
    const appOrigin = process.env.APP_ORIGIN?.trim() || (production ? '' : 'http://localhost:5173');
    if (!appOrigin) throw new Error('APP_ORIGIN is required in production.');
    new URL(appOrigin);
    const trustProxy = boolEnv('TRUST_PROXY', false);
    const authPath = process.env.WHATSAPP_AUTH_PATH?.trim() || '.wwebjs_auth';

    await connectDatabase();
    console.log('[Database] PostgreSQL conectado.');

    const adminRepository = new PrismaAdminRepository(prisma);
    const platformService = new PlatformAdminService(new PrismaPlatformAdminRepository(prisma));
    const companyAuthService = new CompanyAuthService(
      new PrismaCompanyAuthRepository(prisma),
      requiredSecret('SESSION_SECRET', 32),
    );
    await companyAuthService.cleanupExpired();
    cleanupTimer = setInterval(() => { void companyAuthService.cleanupExpired().catch(() => undefined); }, 60 * 60 * 1000);
    cleanupTimer.unref();

    runtimeManager = new CompanyRuntimeManager(prisma, authPath);
    await runtimeManager.start();

    const platformAuth = new PlatformAdminAuth(
      requiredSecret('PLATFORM_ADMIN_PASSWORD', 16), production, appOrigin, trustProxy,
    );
    const companyHttpAuth = new CompanyHttpAuth(companyAuthService, production, appOrigin, trustProxy);

    // Legacy service is never used by production company routes; it preserves the existing HTTP adapter test seam.
    const legacyService = new AdminService(adminRepository, { companyId: 'unbound', companyName: 'Unbound' });
    server = createAdminHttpServer(
      legacyService,
      { service: platformService, auth: platformAuth, refreshCompanyRuntimes: () => runtimeManager!.refresh() },
      { auth: companyHttpAuth, repository: adminRepository, configuration: platformService, runtime: runtimeManager },
      { appOrigin, production },
    );

    const port = envPort();
    server.listen(port, () => {
      console.log(`[HTTP] Servidor disponível na porta ${port}.`);
      console.log(`[Production] APP_ORIGIN=${appOrigin}; WhatsApp auth path=${authPath}.`);
    });
  } catch (error) {
    console.error('[App] Falha ao inicializar dependências:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
    if (server?.listening) server.close();
    if (runtimeManager) await runtimeManager.stop().catch(() => undefined);
    await disconnectDatabase().catch(() => undefined);
  }
}

void main();
