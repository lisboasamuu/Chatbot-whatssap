import { Client, LocalAuth } from 'whatsapp-web.js';

import type { ConversationEngine } from '../conversation/conversation.engine.js';
import { ConversationInactivityManager } from '../conversation/conversation-inactivity.manager.js';
import type { ReminderMessenger, ReminderSendResult } from '../reminders/reminder.messenger.js';
import { registerWhatsAppEvents } from './whatsapp.events.js';

const DEFAULT_AUTH_DATA_PATH = '.wwebjs_auth';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export type WhatsAppConnectionState = 'CONNECTED' | 'CONNECTING' | 'QR_REQUIRED' | 'DISCONNECTED' | 'ERROR';

export interface WhatsAppStatus {
  state: WhatsAppConnectionState;
  ready: boolean;
  qrAvailable: boolean;
  lastError: string | null;
}

export class WhatsAppProvider implements ReminderMessenger {
  private readonly client: Client;
  private readonly inactivityManager: ConversationInactivityManager;
  private state: WhatsAppConnectionState = 'DISCONNECTED';
  private qrValue: string | null = null;
  private lastError: string | null = null;

  public constructor(
    conversationEngine: ConversationEngine,
    private readonly companyId: string,
    authDataPath = DEFAULT_AUTH_DATA_PATH,
  ) {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: authDataPath, clientId: companyId }),
      puppeteer: { headless: true },
    });

    this.inactivityManager = new ConversationInactivityManager(
      async (externalUserId) => {
        const result = await conversationEngine.expireInactiveConversation(externalUserId);
        try {
          await this.client.sendMessage(externalUserId, result.reply);
          console.log('[WhatsApp] Atendimento encerrado por inatividade.');
          try {
            await conversationEngine.recordOutbound(result.conversationId, result.reply);
          } catch {
            console.error('[Database] Encerramento enviado, mas não foi possível registrar o histórico de saída.');
          }
        } catch (error) {
          console.error('[WhatsApp] Erro ao enviar encerramento por inatividade:', error);
        }
      },
      INACTIVITY_TIMEOUT_MS,
    );

    registerWhatsAppEvents(this.client, conversationEngine, this.inactivityManager);
    this.client.on('qr', (qr: string) => {
      this.state = 'QR_REQUIRED';
      this.qrValue = qr;
      this.lastError = null;
    });
    this.client.on('authenticated', () => {
      this.state = 'CONNECTING';
      this.qrValue = null;
      this.lastError = null;
    });
    this.client.on('ready', () => {
      this.state = 'CONNECTED';
      this.qrValue = null;
      this.lastError = null;
    });
    this.client.on('auth_failure', (message: string) => {
      this.state = 'ERROR';
      this.qrValue = null;
      this.lastError = message || 'Falha de autenticação do WhatsApp.';
    });
    this.client.on('disconnected', (reason: string) => {
      this.state = 'DISCONNECTED';
      this.qrValue = null;
      this.lastError = reason || null;
    });
  }

  public async initialize(): Promise<void> {
    this.state = 'CONNECTING';
    this.lastError = null;
    console.log(`[WhatsApp] Inicializando cliente da empresa ${this.companyId}...`);
    try {
      await this.client.initialize();
    } catch (error) {
      this.state = 'ERROR';
      this.lastError = error instanceof Error ? error.message : 'Falha ao inicializar WhatsApp.';
      throw error;
    }
  }

  public async destroy(): Promise<void> {
    this.state = 'DISCONNECTED';
    this.qrValue = null;
    this.inactivityManager.destroy();
    await this.client.destroy();
    console.log(`[WhatsApp] Cliente da empresa ${this.companyId} encerrado.`);
  }

  public async logout(): Promise<void> {
    this.state = 'DISCONNECTED';
    this.qrValue = null;
    await this.client.logout();
  }

  public getStatus(): WhatsAppStatus {
    return {
      state: this.state,
      ready: this.state === 'CONNECTED',
      qrAvailable: this.state === 'QR_REQUIRED' && Boolean(this.qrValue),
      lastError: this.lastError,
    };
  }

  public getQrValue(): string | null {
    return this.state === 'QR_REQUIRED' ? this.qrValue : null;
  }

  public isReady(companyId: string): boolean {
    return this.state === 'CONNECTED' && companyId === this.companyId;
  }

  public async sendReminder(companyId: string, recipient: string, body: string): Promise<ReminderSendResult> {
    if (companyId !== this.companyId) throw new Error('WhatsApp provider cannot send for another company.');
    if (this.state !== 'CONNECTED') throw new Error('WhatsApp channel is not ready.');
    const message = await this.client.sendMessage(recipient, body);
    return { messageId: message.id?._serialized ?? null };
  }
}

export function createWhatsAppProvider(
  conversationEngine: ConversationEngine,
  companyId: string,
  authDataPath = process.env.WHATSAPP_AUTH_PATH?.trim() || DEFAULT_AUTH_DATA_PATH,
): WhatsAppProvider {
  return new WhatsAppProvider(conversationEngine, companyId, authDataPath);
}
