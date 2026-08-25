import qrcode from 'qrcode-terminal';
import type { Client, Message } from 'whatsapp-web.js';

import type { ConversationEngine } from '../conversation/conversation.engine.js';
import type { ConversationMessageType } from '../conversation/conversation.types.js';

const INTERNAL_ERROR_REPLY =
  'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em instantes.';

function shouldIgnoreMessage(message: Message): boolean {
  if (message.fromMe) {
    return true;
  }

  return message.from === 'status@broadcast' || message.from.endsWith('@g.us');
}

function normalizeMessageType(message: Message): ConversationMessageType {
  return message.type === 'chat' ? 'text' : 'unsupported';
}

async function sendReply(message: Message, reply: string): Promise<boolean> {
  try {
    await message.reply(reply);
    console.log('[WhatsApp] Resposta enviada.');
    return true;
  } catch (error) {
    console.error('[WhatsApp] Erro ao enviar resposta:', error);
    return false;
  }
}

async function handleIncomingMessage(
  message: Message,
  conversationEngine: ConversationEngine,
): Promise<void> {
  if (shouldIgnoreMessage(message)) {
    return;
  }

  console.log('[WhatsApp] Mensagem recebida:', {
    from: message.from,
    type: message.type,
  });

  try {
    const result = await conversationEngine.handle({
      conversationId: message.from,
      text: message.body,
      type: normalizeMessageType(message),
    });

    console.log('[Conversation] Mensagem processada:', {
      conversationId: message.from,
      state: result.state,
    });

    const sent = await sendReply(message, result.reply);

    if (sent) {
      try {
        await conversationEngine.recordOutbound(
          result.conversationId,
          result.reply,
        );
      } catch {
        console.error(
          '[Database] Resposta enviada, mas não foi possível registrar o histórico de saída.',
        );
      }
    }
  } catch {
    console.error('[Conversation] Erro inesperado ao processar mensagem.');
    await sendReply(message, INTERNAL_ERROR_REPLY);
  }
}

export function registerWhatsAppEvents(
  client: Client,
  conversationEngine: ConversationEngine,
): void {
  client.on('qr', (qr: string) => {
    console.log(
      '[WhatsApp] QR Code gerado. Escaneie com o aplicativo do WhatsApp:',
    );
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
    void handleIncomingMessage(message, conversationEngine).catch(
      (error: unknown) => {
        console.error('[WhatsApp] Erro ao processar mensagem:', error);
      },
    );
  });

  client.on('disconnected', (reason: string) => {
    console.warn('[WhatsApp] Desconectado:', reason);
  });
}
