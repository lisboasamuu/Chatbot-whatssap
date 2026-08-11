"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const whatsapp_client_1 = require("./whatssap/whatsapp.client");
async function main() {
    const whatsapp = (0, whatsapp_client_1.createWhatsAppProvider)();
    const shutdown = async (signal) => {
        console.log(`[App] Sinal ${signal} recebido. Encerrando cliente WhatsApp...`);
        try {
            await whatsapp.destroy();
        }
        catch (error) {
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
    }
    catch (error) {
        console.error('[App] Falha ao inicializar o cliente WhatsApp:', error);
        process.exitCode = 1;
    }
}
void main();
