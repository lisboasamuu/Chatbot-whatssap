"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const conversation_engine_js_1 = require("./conversation/conversation.engine.js");
const prisma_client_js_1 = require("./database/prisma.client.js");
const prisma_conversation_store_js_1 = require("./database/prisma-conversation.store.js");
const whatsapp_client_js_1 = require("./whatssap/whatsapp.client.js");
async function main() {
    const store = new prisma_conversation_store_js_1.PrismaConversationStore(prisma_client_js_1.prisma);
    const conversationEngine = new conversation_engine_js_1.ConversationEngine(store);
    const whatsapp = (0, whatsapp_client_js_1.createWhatsAppProvider)(conversationEngine);
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        console.log(`[App] Sinal ${signal} recebido. Encerrando aplicação...`);
        try {
            await whatsapp.destroy();
        }
        catch (error) {
            console.error('[App] Erro ao encerrar cliente WhatsApp:', error);
            process.exitCode = 1;
        }
        try {
            await (0, prisma_client_js_1.disconnectDatabase)();
        }
        catch (error) {
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
        await (0, prisma_client_js_1.connectDatabase)();
        console.log('[Database] PostgreSQL conectado.');
        await whatsapp.initialize();
    }
    catch {
        console.error('[App] Falha ao inicializar dependências. Verifique PostgreSQL e WhatsApp.');
        process.exitCode = 1;
        await (0, prisma_client_js_1.disconnectDatabase)().catch(() => undefined);
    }
}
void main();
