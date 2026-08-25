"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWhatsAppEvents = registerWhatsAppEvents;
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const INTERNAL_ERROR_REPLY = 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em instantes.';
function shouldIgnoreMessage(message) {
    if (message.fromMe) {
        return true;
    }
    return message.from === 'status@broadcast' || message.from.endsWith('@g.us');
}
function normalizeMessageType(message) {
    return message.type === 'chat' ? 'text' : 'unsupported';
}
async function sendReply(message, reply) {
    try {
        await message.reply(reply);
        console.log('[WhatsApp] Resposta enviada.');
        return true;
    }
    catch (error) {
        console.error('[WhatsApp] Erro ao enviar resposta:', error);
        return false;
    }
}
async function handleIncomingMessage(message, conversationEngine) {
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
                await conversationEngine.recordOutbound(result.conversationId, result.reply);
            }
            catch {
                console.error('[Database] Resposta enviada, mas não foi possível registrar o histórico de saída.');
            }
        }
    }
    catch {
        console.error('[Conversation] Erro inesperado ao processar mensagem.');
        await sendReply(message, INTERNAL_ERROR_REPLY);
    }
}
function registerWhatsAppEvents(client, conversationEngine) {
    client.on('qr', (qr) => {
        console.log('[WhatsApp] QR Code gerado. Escaneie com o aplicativo do WhatsApp:');
        qrcode_terminal_1.default.generate(qr, { small: true });
    });
    client.on('authenticated', () => {
        console.log('[WhatsApp] Autenticado.');
    });
    client.on('ready', () => {
        console.log('[WhatsApp] Cliente conectado e pronto.');
    });
    client.on('auth_failure', (message) => {
        console.error('[WhatsApp] Falha de autenticação:', message);
    });
    client.on('message', (message) => {
        void handleIncomingMessage(message, conversationEngine).catch((error) => {
            console.error('[WhatsApp] Erro ao processar mensagem:', error);
        });
    });
    client.on('disconnected', (reason) => {
        console.warn('[WhatsApp] Desconectado:', reason);
    });
}
