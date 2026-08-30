import { Client, LocalAuth } from 'whatsapp-web.js';

import type { ConversationEngine } from '../conversation/conversation.engine.js';
import { ConversationInactivityManager } from '../conversation/conversation-inactivity.manager.js';
import { registerWhatsAppEvents } from './whatsapp.events.js';

const AUTH_DATA_PATH = '.wwebjs_auth';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export class WhatsAppProvider {
  private readonly client: Client;
  private readonly inactivityManager: ConversationInactivityManager;

  public constructor(conversationEngine: ConversationEngine) {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: AUTH_DATA_PATH,
      }),
      puppeteer: {
        headless: true,
      },
    });

    this.inactivityManager = new ConversationInactivityManager(
      async (externalUserId) => {
        const result = await conversationEngine.expireInactiveConversation(
          externalUserId,
        );

        try {
          await this.client.sendMessage(externalUserId, result.reply);
          console.log('[WhatsApp] Atendimento encerrado por inatividade.');

          try {
            await conversationEngine.recordOutbound(
              result.conversationId,
              result.reply,
            );
          } catch {
            console.error(
              '[Database] Encerramento enviado, mas não foi possível registrar o histórico de saída.',
            );
          }
        } catch (error) {
          console.error(
            '[WhatsApp] Erro ao enviar encerramento por inatividade:',
            error,
          );
        }
      },
      INACTIVITY_TIMEOUT_MS,
    );

    registerWhatsAppEvents(
      this.client,
      conversationEngine,
      this.inactivityManager,
    );
  }

  public async initialize(): Promise<void> {
    console.log('[WhatsApp] Inicializando cliente...');
    await this.client.initialize();
  }

  public async destroy(): Promise<void> {
    this.inactivityManager.destroy();
    await this.client.destroy();
    console.log('[WhatsApp] Cliente encerrado.');
  }
}

export function createWhatsAppProvider(
  conversationEngine: ConversationEngine,
): WhatsAppProvider {
  return new WhatsAppProvider(conversationEngine);
}
