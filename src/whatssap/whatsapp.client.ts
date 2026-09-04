import { Client, LocalAuth } from 'whatsapp-web.js';

import type { ConversationEngine } from '../conversation/conversation.engine.js';
import { ConversationInactivityManager } from '../conversation/conversation-inactivity.manager.js';
import type {
  ReminderMessenger,
  ReminderSendResult,
} from '../reminders/reminder.messenger.js';
import { registerWhatsAppEvents } from './whatsapp.events.js';

const AUTH_DATA_PATH = '.wwebjs_auth';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export class WhatsAppProvider implements ReminderMessenger {
  private readonly client: Client;
  private readonly inactivityManager: ConversationInactivityManager;
  private ready = false;

  public constructor(
    conversationEngine: ConversationEngine,
    private readonly companyId: string,
  ) {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: AUTH_DATA_PATH,
        clientId: companyId,
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
    this.client.on('ready', () => {
      this.ready = true;
    });
    this.client.on('auth_failure', () => {
      this.ready = false;
    });
    this.client.on('disconnected', () => {
      this.ready = false;
    });
  }

  public async initialize(): Promise<void> {
    console.log('[WhatsApp] Inicializando cliente...');
    await this.client.initialize();
  }

  public async destroy(): Promise<void> {
    this.ready = false;
    this.inactivityManager.destroy();
    await this.client.destroy();
    console.log('[WhatsApp] Cliente encerrado.');
  }

  public isReady(companyId: string): boolean {
    return this.ready && companyId === this.companyId;
  }

  public async sendReminder(
    companyId: string,
    recipient: string,
    body: string,
  ): Promise<ReminderSendResult> {
    if (companyId !== this.companyId) {
      throw new Error('WhatsApp provider cannot send for another company.');
    }
    if (!this.ready) {
      throw new Error('WhatsApp channel is not ready.');
    }

    const message = await this.client.sendMessage(recipient, body);
    return { messageId: message.id?._serialized ?? null };
  }
}

export function createWhatsAppProvider(
  conversationEngine: ConversationEngine,
  companyId: string,
): WhatsAppProvider {
  return new WhatsAppProvider(conversationEngine, companyId);
}
