"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWhatsAppEvents = registerWhatsAppEvents;
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const AUTO_REPLY = 'Olá! Sua mensagem foi recebida com sucesso.';
function shouldIgnoreMessage(message) {
    if (message.fromMe) {
        return true;
    }
    if (message.from === 'status@broadcast' || message.from.endsWith('@g.us')) {
        return true;
    }
    return message.body.trim().length === 0;
}
async function handleIncomingMessage(message) {
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
    }
    catch (error) {
        console.error('[WhatsApp] Erro ao enviar resposta:', error);
    }
}
function registerWhatsAppEvents(client) {
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
        void handleIncomingMessage(message).catch((error) => {
            console.error('[WhatsApp] Erro ao processar mensagem:', error);
        });
    });
    client.on('disconnected', (reason) => {
        console.warn('[WhatsApp] Desconectado:', reason);
    });
}
