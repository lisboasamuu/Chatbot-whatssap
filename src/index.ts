import { createWhatsAppProvider } from './whatssap/whatsapp.client';

async function main(): Promise<void> {
  const whatsapp = createWhatsAppProvider();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.log(
      `[App] Sinal ${signal} recebido. Encerrando cliente WhatsApp...`,
    );

    try {
      await whatsapp.destroy();
    } catch (error) {
      console.error('[App] Erro ao encerrar cliente WhatsApp:', error);
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
    await whatsapp.initialize();
  } catch (error) {
    console.error('[App] Falha ao inicializar o cliente WhatsApp:', error);
    process.exitCode = 1;
  }
}

void main();
