"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppProvider = void 0;
exports.createWhatsAppProvider = createWhatsAppProvider;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const whatsapp_events_js_1 = require("./whatsapp.events.js");
const AUTH_DATA_PATH = '.wwebjs_auth';
class WhatsAppProvider {
    client;
    constructor() {
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                dataPath: AUTH_DATA_PATH,
            }),
            puppeteer: {
                headless: true,
            },
        });
        (0, whatsapp_events_js_1.registerWhatsAppEvents)(this.client);
    }
    async initialize() {
        console.log('[WhatsApp] Inicializando cliente...');
        await this.client.initialize();
    }
    async destroy() {
        await this.client.destroy();
        console.log('[WhatsApp] Cliente encerrado.');
    }
}
exports.WhatsAppProvider = WhatsAppProvider;
function createWhatsAppProvider() {
    return new WhatsAppProvider();
}
