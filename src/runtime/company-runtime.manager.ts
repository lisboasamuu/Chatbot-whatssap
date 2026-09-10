import type { PrismaClient } from '@prisma/client';
import { AppointmentService } from '../appointments/appointment.service.js';
import { PrismaCompanyConfigService } from '../company-config/company-config.service.js';
import { ConversationEngine } from '../conversation/conversation.engine.js';
import { PrismaAppointmentStore } from '../database/prisma-appointment.store.js';
import { PrismaConversationStore } from '../database/prisma-conversation.store.js';
import { PrismaReminderRepository } from '../database/prisma-reminder.repository.js';
import type { ReminderMessenger, ReminderSendResult } from '../reminders/reminder.messenger.js';
import { AppointmentReminderWorker, ReminderScheduler } from '../reminders/reminder.worker.js';
import { createWhatsAppProvider, type WhatsAppProvider, type WhatsAppStatus } from '../whatssap/whatsapp.client.js';
import { AutomationService } from '../automations/automation.service.js';
import { AutomationScheduler, AutomationWorker } from '../automations/automation.worker.js';

const REFRESH_INTERVAL_MS = 30_000;

class RuntimeMessenger implements ReminderMessenger {
  public provider: WhatsAppProvider | null = null;
  public isReady(companyId: string): boolean { return this.provider?.isReady(companyId) ?? false; }
  public sendReminder(companyId: string, recipient: string, body: string): Promise<ReminderSendResult> {
    if (!this.provider) return Promise.reject(new Error('WhatsApp channel is unavailable.'));
    return this.provider.sendReminder(companyId, recipient, body);
  }
}

interface CompanyRuntime {
  companyId: string;
  engine: ConversationEngine;
  messenger: RuntimeMessenger;
  scheduler: ReminderScheduler;
  automationScheduler: AutomationScheduler;
}

export interface ManagedWhatsAppStatus extends WhatsAppStatus {
  enabled: boolean;
}

export class CompanyRuntimeManager {
  private readonly runtimes = new Map<string, CompanyRuntime>();
  private readonly runtimeStarts = new Map<string, Promise<CompanyRuntime>>();
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshInFlight: Promise<void> | null = null;

  public constructor(
    private readonly prisma: PrismaClient,
    private readonly authDataPath: string,
  ) {}

  public async start(): Promise<void> {
    await this.refresh();
    this.refreshTimer = setInterval(() => { void this.refresh(); }, REFRESH_INTERVAL_MS);
  }

  public async stop(): Promise<void> {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    await this.refreshInFlight;
    await Promise.all([...this.runtimes.keys()].map((companyId) => this.stopRuntime(companyId, false)));
  }

  public async refresh(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doRefresh().finally(() => { this.refreshInFlight = null; });
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<void> {
    const companies = await this.prisma.company.findMany({
      select: { id: true, status: true, settings: { select: { whatsappEnabled: true } } },
    });
    const active = new Set(companies.filter((company) => company.status === 'ACTIVE').map((company) => company.id));
    for (const companyId of [...this.runtimes.keys()]) {
      if (!active.has(companyId)) await this.stopRuntime(companyId, false);
    }
    for (const company of companies) {
      if (company.status !== 'ACTIVE') continue;
      const runtime = await this.ensureRuntime(company.id);
      const shouldConnect = company.settings?.whatsappEnabled ?? true;
      if (shouldConnect && !runtime.messenger.provider) this.startProvider(runtime);
      if (!shouldConnect && runtime.messenger.provider) await this.stopProvider(runtime, false);
    }
  }

  private async ensureRuntime(companyId: string): Promise<CompanyRuntime> {
    const existing = this.runtimes.get(companyId);
    if (existing) return existing;
    const starting = this.runtimeStarts.get(companyId);
    if (starting) return starting;
    const promise = this.createRuntime(companyId).finally(() => { this.runtimeStarts.delete(companyId); });
    this.runtimeStarts.set(companyId, promise);
    return promise;
  }

  private async createRuntime(companyId: string): Promise<CompanyRuntime> {
    const companyConfig = new PrismaCompanyConfigService(this.prisma, companyId);
    const operationalConfig = await companyConfig.getOperationalConfig();
    if (operationalConfig.status !== 'ACTIVE') throw new Error('Company is inactive.');
    const appointmentService = new AppointmentService(
      new PrismaAppointmentStore(this.prisma, companyId), undefined, companyConfig, operationalConfig.timezone,
    );
    const engine = new ConversationEngine(
      new PrismaConversationStore(this.prisma, companyId), appointmentService, companyConfig,
      new AutomationService(this.prisma, companyId, operationalConfig.timezone),
    );
    const messenger = new RuntimeMessenger();
    const scheduler = new ReminderScheduler(
      new AppointmentReminderWorker(new PrismaReminderRepository(this.prisma), messenger, companyId),
    );
    const automationScheduler = new AutomationScheduler(
      new AutomationWorker(this.prisma, messenger, companyId),
    );
    const runtime = { companyId, engine, messenger, scheduler, automationScheduler };
    this.runtimes.set(companyId, runtime);
    scheduler.start();
    automationScheduler.start();
    return runtime;
  }

  private startProvider(runtime: CompanyRuntime): void {
    if (runtime.messenger.provider) return;
    const provider = createWhatsAppProvider(runtime.engine, runtime.companyId, this.authDataPath);
    runtime.messenger.provider = provider;
    void provider.initialize().catch((error: unknown) => {
      console.error(`[WhatsApp] Falha ao inicializar empresa ${runtime.companyId}:`, error instanceof Error ? error.message : error);
    });
  }

  private async stopProvider(runtime: CompanyRuntime, logout: boolean): Promise<void> {
    const provider = runtime.messenger.provider;
    runtime.messenger.provider = null;
    if (!provider) return;
    if (logout) {
      try { await provider.logout(); } catch (error) {
        console.error(`[WhatsApp] Falha ao fazer logout da empresa ${runtime.companyId}:`, error instanceof Error ? error.message : error);
      }
    }
    try { await provider.destroy(); } catch (error) {
      console.error(`[WhatsApp] Falha ao encerrar empresa ${runtime.companyId}:`, error instanceof Error ? error.message : error);
    }
  }

  private async stopRuntime(companyId: string, logout: boolean): Promise<void> {
    const runtime = this.runtimes.get(companyId);
    if (!runtime) return;
    this.runtimes.delete(companyId);
    await runtime.scheduler.stop();
    await runtime.automationScheduler.stop();
    await this.stopProvider(runtime, logout);
  }

  public async connectWhatsApp(companyId: string): Promise<ManagedWhatsAppStatus> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { status: true } });
    if (!company || company.status !== 'ACTIVE') throw new Error('Company is inactive.');
    await this.prisma.companySettings.upsert({
      where: { companyId }, create: { companyId, whatsappEnabled: true }, update: { whatsappEnabled: true },
    });
    const runtime = await this.ensureRuntime(companyId);
    if (runtime.messenger.provider && runtime.messenger.provider.getStatus().state !== 'CONNECTED') {
      await this.stopProvider(runtime, false);
    }
    if (!runtime.messenger.provider) this.startProvider(runtime);
    return this.getWhatsAppStatus(companyId);
  }

  public async disconnectWhatsApp(companyId: string): Promise<ManagedWhatsAppStatus> {
    await this.prisma.companySettings.upsert({
      where: { companyId }, create: { companyId, whatsappEnabled: false }, update: { whatsappEnabled: false },
    });
    const runtime = this.runtimes.get(companyId);
    if (runtime) await this.stopProvider(runtime, true);
    return this.getWhatsAppStatus(companyId);
  }

  public async getWhatsAppStatus(companyId: string): Promise<ManagedWhatsAppStatus> {
    const settings = await this.prisma.companySettings.findUnique({ where: { companyId }, select: { whatsappEnabled: true } });
    const enabled = settings?.whatsappEnabled ?? true;
    const provider = this.runtimes.get(companyId)?.messenger.provider;
    return provider ? { ...provider.getStatus(), enabled } : {
      state: 'DISCONNECTED', ready: false, qrAvailable: false, lastError: null, enabled,
    };
  }

  public getQrValue(companyId: string): string | null {
    return this.runtimes.get(companyId)?.messenger.provider?.getQrValue() ?? null;
  }
}
