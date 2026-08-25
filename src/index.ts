import { ConversationEngine } from './conversation/conversation.engine.js';
import {
  connectDatabase,
  disconnectDatabase,
  prisma,
} from './database/prisma.client.js';
import { PrismaConversationStore } from './database/prisma-conversation.store.js';
import { createWhatsAppProvider } from './whatssap/whatsapp.client.js';

async function main(): Promise<void> {
  const store = new PrismaConversationStore(prisma);
  const conversationEngine = new ConversationEngine(store);
  const whatsapp = createWhatsAppProvider(conversationEngine);
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log(`[App] Sinal ${signal} recebido. Encerrando aplicação...`);

    try {
      await whatsapp.destroy();
    } catch (error) {
      console.error('[App] Erro ao encerrar cliente WhatsApp:', error);
      process.exitCode = 1;
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
    await whatsapp.initialize();
  } catch {
    console.error(
      '[App] Falha ao inicializar dependências. Verifique PostgreSQL e WhatsApp.',
    );
    process.exitCode = 1;
    await disconnectDatabase().catch(() => undefined);
  }
}

void main();
