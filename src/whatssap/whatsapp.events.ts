import qrcode from 'qrcode-terminal';
import type { Client, Message } from 'whatsapp-web.js';

const AUTO_REPLY = 'Olá! Sua mensagem foi recebida com sucesso.';

function shouldIgnoreMessage(message: Message): boolean {
  if (message.fromMe) {
    return true;
  }

  if (message.from === 'status@broadcast' || message.from.endsWith('@g.us')) {
    return true;
  }

  return message.body.trim().length === 0;
}

async function handleIncomingMessage(message: Message): Promise<void> {
  if (shouldIgnoreMessage(message)) {
    return;
  }

  console.log('[WhatsApp] Mensagem recebida:', {
    from: message.from,
    type: message.type,
  });

  try {
    await message.reply(AUTO_REPLY);
    console.log('[WhatsApp] Resposta enviada.');
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar resposta:', error);
  }
}

export function registerWhatsAppEvents(client: Client): void {
  client.on('qr', (qr: string) => {
    console.log('[WhatsApp] QR Code gerado. Escaneie com o aplicativo do WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    console.log('[WhatsApp] Autenticado.');
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Cliente conectado e pronto.');
  });

  client.on('auth_failure', (message: string) => {
    console.error('[WhatsApp] Falha de autenticação:', message);
  });

  client.on('message', (message: Message) => {
    void handleIncomingMessage(message).catch((error: unknown) => {
      console.error('[WhatsApp] Erro ao processar mensagem:', error);
    });
  });

  client.on('disconnected', (reason: string) => {
    console.warn('[WhatsApp] Desconectado:', reason);
  });
}
