import { AdminService } from './admin/admin.service.js';
import { createAdminHttpServer } from './admin/admin.http.js';
import { AppointmentService } from './appointments/appointment.service.js';
import { ConversationEngine } from './conversation/conversation.engine.js';
import { PrismaAdminRepository } from './database/prisma-admin.repository.js';
import { PrismaAppointmentStore } from './database/prisma-appointment.store.js';
import { PrismaCompanyLookup } from './database/prisma-company.lookup.js';
import {
  connectDatabase,
  disconnectDatabase,
  prisma,
} from './database/prisma.client.js';
import { PrismaConversationStore } from './database/prisma-conversation.store.js';
import { resolveTenantContext } from './tenant/tenant.context.js';
import { createWhatsAppProvider } from './whatssap/whatsapp.client.js';

const DEFAULT_ADMIN_HTTP_PORT = 3001;

function getAdminHttpPort(): number {
  const raw = process.env.ADMIN_HTTP_PORT?.trim();
  if (!raw) {
    return DEFAULT_ADMIN_HTTP_PORT;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('ADMIN_HTTP_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

async function main(): Promise<void> {
  let adminHttpServer: ReturnType<typeof createAdminHttpServer> | null = null;
  let whatsapp: ReturnType<typeof createWhatsAppProvider> | null = null;
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`[App] Sinal ${signal} recebido. Encerrando aplicação...`);

    await new Promise<void>((resolve) => {
      if (!adminHttpServer?.listening) {
        resolve();
        return;
      }

      adminHttpServer.close((error) => {
        if (error) {
          console.error('[Admin HTTP] Erro ao encerrar servidor:', error);
          process.exitCode = 1;
        }
        resolve();
      });
    });

    if (whatsapp) {
      try {
        await whatsapp.destroy();
      } catch (error) {
        console.error('[App] Erro ao encerrar cliente WhatsApp:', error);
        process.exitCode = 1;
      }
    }

    try {
      await disconnectDatabase();
    } catch (error) {
      console.error('[App] Erro ao desconectar PostgreSQL:', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await connectDatabase();
    console.log('[Database] PostgreSQL conectado.');

    const tenant = await resolveTenantContext(
      new PrismaCompanyLookup(prisma),
      process.env.COMPANY_ID,
    );
    console.log(
      `[Tenant] Empresa ativa: ${tenant.companyName} (${tenant.companyId}).`,
    );

    const conversationStore = new PrismaConversationStore(
      prisma,
      tenant.companyId,
    );
    const appointmentStore = new PrismaAppointmentStore(
      prisma,
      tenant.companyId,
    );
    const appointmentService = new AppointmentService(appointmentStore);
    const conversationEngine = new ConversationEngine(
      conversationStore,
      appointmentService,
    );
    const adminRepository = new PrismaAdminRepository(prisma);
    const adminService = new AdminService(adminRepository, tenant);
    adminHttpServer = createAdminHttpServer(adminService);
    whatsapp = createWhatsAppProvider(conversationEngine, tenant.companyId);

    const adminPort = getAdminHttpPort();
    adminHttpServer.listen(adminPort, () => {
      console.log(
        `[Admin HTTP] Servidor disponível em http://localhost:${adminPort}.`,
      );
    });

    await whatsapp.initialize();
  } catch {
    console.error(
      '[App] Falha ao inicializar dependências. Verifique PostgreSQL, tenant, configuração HTTP e WhatsApp.',
    );
    process.exitCode = 1;
    if (adminHttpServer?.listening) {
      adminHttpServer.close();
    }
    await disconnectDatabase().catch(() => undefined);
  }
}

void main();
