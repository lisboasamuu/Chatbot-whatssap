import { Client, LocalAuth } from 'whatsapp-web.js';

import { registerWhatsAppEvents } from './whatsapp.events.js';

const AUTH_DATA_PATH = '.wwebjs_auth';

export class WhatsAppProvider {
  private readonly client: Client;

  public constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: AUTH_DATA_PATH,
      }),
      puppeteer: {
        headless: true,
      },
    });

    registerWhatsAppEvents(this.client);
  }

  public async initialize(): Promise<void> {
    console.log('[WhatsApp] Inicializando cliente...');
    await this.client.initialize();
  }

  public async destroy(): Promise<void> {
    await this.client.destroy();
    console.log('[WhatsApp] Cliente encerrado.');
  }
}

export function createWhatsAppProvider(): WhatsAppProvider {
  return new WhatsAppProvider();
}
