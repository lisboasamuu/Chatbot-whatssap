import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { InvalidCompanyCredentialsError } from '../company-auth/company-auth.service.js';
import type { CompanyHttpAuth } from '../company-auth/company-auth.http.js';
import { applyCors, applySecurityHeaders, type HttpSecurityConfig } from '../http/http-security.js';
import { qrValueToDataUrl } from '../whatssap/qr-svg.js';
import type { CompanyRuntimeManager } from '../runtime/company-runtime.manager.js';
import type { PlatformAdminService } from '../platform-admin/platform-admin.service.js';
import {
  handlePlatformError,
  handlePlatformRequest,
  type PlatformHttpDependencies,
} from '../platform-admin/platform-admin.http.js';
import { AdminResourceNotFoundError, AdminService } from './admin.service.js';
import type { AdminRepository } from './admin.repository.js';
import type { PrismaClient } from '@prisma/client';
import { AutomationService } from '../automations/automation.service.js';
import {
  AutomationNotFoundError,
  AutomationValidationError,
  type AutomationInput,
} from '../automations/automation.types.js';

const MAX_BODY_BYTES = 64 * 1024;

interface ErrorBody { error: { code: string; message: string } }
export interface CompanyHttpDependencies {
  auth: CompanyHttpAuth;
  repository: AdminRepository;
  configuration: PlatformAdminService;
  runtime: CompanyRuntimeManager;
  prisma?: PrismaClient;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}
function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  const body: ErrorBody = { error: { code, message } };
  sendJson(response, status, body);
}
async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_JSON');
  return value as Record<string, unknown>;
}
function parseLimit(url: URL, defaultValue: number, maxValue: number): number | null {
  const raw = url.searchParams.get('limit');
  if (raw === null) return defaultValue;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maxValue) return null;
  return value;
}
function customerRoute(pathname: string): { customerId: string; conversation: boolean } | null {
  const match = /^\/api\/customers\/([^/]+)(\/conversation)?$/.exec(pathname);
  if (!match) return null;
  try { return { customerId: decodeURIComponent(match[1]!), conversation: Boolean(match[2]) }; } catch { return null; }
}
function automationRoute(pathname: string): { automationId: string; action: 'detail' | 'status' } | null {
  const match = /^\/api\/automations\/([^/]+)(\/status)?$/.exec(pathname);
  if (!match) return null;
  try {
    return { automationId: decodeURIComponent(match[1]!), action: match[2] ? 'status' : 'detail' };
  } catch {
    return null;
  }
}
function mutation(method: string | undefined): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

async function authenticateCompany(
  request: IncomingMessage,
  response: ServerResponse,
  company: CompanyHttpDependencies,
) {
  try {
    const context = await company.auth.authenticate(request);
    if (!context) {
      sendError(response, 401, 'UNAUTHORIZED', 'Sessão empresarial ausente ou expirada.');
      return null;
    }
    return context;
  } catch (error) {
    if (company.auth.isInactiveError(error)) {
      sendError(response, 403, 'COMPANY_INACTIVE', 'Empresa inativa.');
      return null;
    }
    throw error;
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  legacyService: AdminService,
  platform?: PlatformHttpDependencies,
  company?: CompanyHttpDependencies,
): Promise<void> {
  if (platform && await handlePlatformRequest(request, response, platform)) return;
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (company) {
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      if (!company.auth.isSameOrigin(request)) { sendError(response, 403, 'FORBIDDEN', 'Origem não permitida.'); return; }
      if (!company.auth.canAttemptLogin(request)) { sendError(response, 401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.'); return; }
      const body = await readJson(request);
      const email = typeof body.email === 'string' ? body.email : '';
      const password = typeof body.password === 'string' ? body.password : '';
      try {
        const context = await company.auth.createSession(email, password, response);
        company.auth.clearLoginFailures(request);
        sendJson(response, 200, { authenticated: true, company: { id: context.companyId, name: context.companyName, email: context.email } });
      } catch (error) {
        if (error instanceof InvalidCompanyCredentialsError) {
          company.auth.recordLoginFailure(request);
          sendError(response, 401, 'INVALID_CREDENTIALS', 'Credenciais inválidas.');
          return;
        }
        if (company.auth.isInactiveError(error)) {
          sendError(response, 403, 'COMPANY_INACTIVE', 'Empresa inativa.');
          return;
        }
        throw error;
      }
      return;
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      if (!company.auth.isSameOrigin(request)) { sendError(response, 403, 'FORBIDDEN', 'Origem não permitida.'); return; }
      await company.auth.clearSession(request, response);
      sendJson(response, 200, { authenticated: false });
      return;
    }

    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const context = await authenticateCompany(request, response, company);
      if (!context) return;
      sendJson(response, 200, { authenticated: true, company: { id: context.companyId, name: context.companyName, email: context.email } });
      return;
    }

    const context = await authenticateCompany(request, response, company);
    if (!context) return;
    if (mutation(request.method) && !company.auth.isSameOrigin(request)) {
      sendError(response, 403, 'FORBIDDEN', 'Origem não permitida.');
      return;
    }

    const service = new AdminService(
      company.repository,
      { companyId: context.companyId, companyName: context.companyName },
      undefined,
      context.timezone,
    );
    const automations = company.prisma
      ? new AutomationService(company.prisma, context.companyId, context.timezone)
      : null;

    if (url.pathname === '/api/automations' && request.method === 'GET' && automations) {
      sendJson(response, 200, { automations: await automations.list() });
      return;
    }
    if (url.pathname === '/api/automations' && request.method === 'POST' && automations) {
      const body = await readJson(request);
      sendJson(response, 201, { automation: await automations.create(body as unknown as AutomationInput) });
      return;
    }
    if (url.pathname === '/api/customers' && request.method === 'POST' && automations) {
      const body = await readJson(request);
      const customer = await automations.createManualCustomer(body.name, body.phone);
      sendJson(response, 201, { customer });
      return;
    }
    const automation = automationRoute(url.pathname);
    if (automation && automations) {
      if (automation.action === 'detail' && request.method === 'GET') {
        sendJson(response, 200, { automation: await automations.get(automation.automationId) });
        return;
      }
      if (automation.action === 'detail' && request.method === 'PUT') {
        const body = await readJson(request);
        sendJson(response, 200, { automation: await automations.update(automation.automationId, body as unknown as AutomationInput) });
        return;
      }
      if (automation.action === 'detail' && request.method === 'DELETE') {
        await automations.remove(automation.automationId);
        response.statusCode = 204;
        response.end();
        return;
      }
      if (automation.action === 'status' && request.method === 'PATCH') {
        const body = await readJson(request);
        if (typeof body.isActive !== 'boolean') {
          throw new AutomationValidationError('INVALID_INPUT', 'Informe se a automação está ativa.');
        }
        sendJson(response, 200, { automation: await automations.setActive(automation.automationId, body.isActive) });
        return;
      }
      sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      return;
    }

    if (url.pathname === '/api/company/configuration' && request.method === 'GET') {
      const detail = await company.configuration.getCompany(context.companyId);
      sendJson(response, 200, { configuration: {
        businessHours: detail.businessHours,
        messageTemplates: detail.messageTemplates,
        settings: detail.settings,
        reminders: detail.reminders,
        whatsappEnabled: detail.whatsappEnabled,
      } });
      return;
    }
    if (url.pathname === '/api/company/business-hours' && request.method === 'PUT') {
      const body = await readJson(request);
      const detail = await company.configuration.replaceBusinessHours(context.companyId, body.hours);
      sendJson(response, 200, { businessHours: detail.businessHours });
      return;
    }
    if (url.pathname === '/api/company/messages' && request.method === 'PUT') {
      const body = await readJson(request);
      const detail = await company.configuration.replaceMessageTemplates(context.companyId, body.templates);
      sendJson(response, 200, { messageTemplates: detail.messageTemplates });
      return;
    }
    if (url.pathname === '/api/company/settings' && request.method === 'PUT') {
      const body = await readJson(request);
      const detail = await company.configuration.updateSettings(context.companyId, body);
      sendJson(response, 200, { settings: detail.settings });
      return;
    }
    if (url.pathname === '/api/company/reminders' && request.method === 'PUT') {
      const body = await readJson(request);
      const detail = await company.configuration.updateReminderConfiguration(context.companyId, body);
      sendJson(response, 200, { reminders: detail.reminders, messageTemplates: detail.messageTemplates });
      return;
    }
    if (url.pathname === '/api/whatsapp/status' && request.method === 'GET') {
      sendJson(response, 200, { status: await company.runtime.getWhatsAppStatus(context.companyId) });
      return;
    }
    if (url.pathname === '/api/whatsapp/qr' && request.method === 'GET') {
      const status = await company.runtime.getWhatsAppStatus(context.companyId);
      const value = company.runtime.getQrValue(context.companyId);
      sendJson(response, 200, { status, qr: value ? qrValueToDataUrl(value) : null });
      return;
    }
    if (url.pathname === '/api/whatsapp/connect' && request.method === 'POST') {
      sendJson(response, 200, { status: await company.runtime.connectWhatsApp(context.companyId) });
      return;
    }
    if (url.pathname === '/api/whatsapp/disconnect' && request.method === 'POST') {
      sendJson(response, 200, { status: await company.runtime.disconnectWhatsApp(context.companyId) });
      return;
    }

    if (request.method !== 'GET') { sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.'); return; }
    if (url.pathname === '/api/company/current') { sendJson(response, 200, { company: service.getCompany() }); return; }
    if (url.pathname === '/api/dashboard/summary') {
      const limit = parseLimit(url, 5, 20);
      if (limit === null) { sendError(response, 400, 'INVALID_LIMIT', 'limit must be an integer between 1 and 20.'); return; }
      sendJson(response, 200, await service.getSummary(limit)); return;
    }
    if (url.pathname === '/api/appointments/upcoming') {
      const limit = parseLimit(url, 100, 100);
      if (limit === null) { sendError(response, 400, 'INVALID_LIMIT', 'limit must be an integer between 1 and 100.'); return; }
      sendJson(response, 200, { appointments: await service.listUpcomingAppointments(limit) }); return;
    }
    if (url.pathname === '/api/customers') { sendJson(response, 200, { customers: await service.listCustomers() }); return; }
    const customer = customerRoute(url.pathname);
    if (customer) {
      if (customer.conversation) { sendJson(response, 200, { conversation: await service.getConversation(customer.customerId) }); return; }
      sendJson(response, 200, { customer: await service.getCustomer(customer.customerId) }); return;
    }
    sendError(response, 404, 'NOT_FOUND', 'Resource not found.');
    return;
  }

  // Legacy path retained only for existing unit tests; production always supplies company dependencies.
  if (request.method !== 'GET') { sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.'); return; }
  if (url.pathname === '/api/company/current') { sendJson(response, 200, { company: legacyService.getCompany() }); return; }
  if (url.pathname === '/api/dashboard/summary') {
    const limit = parseLimit(url, 5, 20);
    if (limit === null) { sendError(response, 400, 'INVALID_LIMIT', 'limit must be an integer between 1 and 20.'); return; }
    sendJson(response, 200, await legacyService.getSummary(limit)); return;
  }
  if (url.pathname === '/api/appointments/upcoming') {
    const limit = parseLimit(url, 100, 100);
    if (limit === null) { sendError(response, 400, 'INVALID_LIMIT', 'limit must be an integer between 1 and 100.'); return; }
    sendJson(response, 200, { appointments: await legacyService.listUpcomingAppointments(limit) }); return;
  }
  if (url.pathname === '/api/customers') { sendJson(response, 200, { customers: await legacyService.listCustomers() }); return; }
  const customer = customerRoute(url.pathname);
  if (customer) {
    if (customer.conversation) { sendJson(response, 200, { conversation: await legacyService.getConversation(customer.customerId) }); return; }
    sendJson(response, 200, { customer: await legacyService.getCustomer(customer.customerId) }); return;
  }
  sendError(response, 404, 'NOT_FOUND', 'Resource not found.');
}

export function createAdminHttpServer(
  service: AdminService,
  platform?: PlatformHttpDependencies,
  company?: CompanyHttpDependencies,
  security: HttpSecurityConfig = { appOrigin: 'http://localhost:5173', production: false },
): Server {
  return createServer((request, response) => {
    applySecurityHeaders(response, security.production);
    if (applyCors(request, response, security)) return;
    void handleRequest(request, response, service, platform, company).catch((error: unknown) => {
      if (handlePlatformError(response, error)) return;
      if (error instanceof AutomationNotFoundError) { sendError(response, 404, 'NOT_FOUND', error.message); return; }
      if (error instanceof AutomationValidationError) { sendError(response, 400, error.code, error.message); return; }
      if (error instanceof AdminResourceNotFoundError) { sendError(response, 404, 'NOT_FOUND', error.message); return; }
      if (error instanceof SyntaxError || (error instanceof Error && error.message === 'INVALID_JSON')) { sendError(response, 400, 'INVALID_JSON', 'JSON inválido.'); return; }
      if (error instanceof Error && error.message === 'REQUEST_BODY_TOO_LARGE') { sendError(response, 413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição muito grande.'); return; }
      console.error('[Admin HTTP] Internal request error.');
      sendError(response, 500, 'INTERNAL_ERROR', 'Internal server error.');
    });
  });
}
