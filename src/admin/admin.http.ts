import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { AdminResourceNotFoundError, type AdminService } from './admin.service.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  const body: ErrorBody = { error: { code, message } };
  sendJson(response, status, body);
}

function parseLimit(url: URL, defaultValue: number, maxValue: number): number | null {
  const raw = url.searchParams.get('limit');
  if (raw === null) {
    return defaultValue;
  }

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maxValue) {
    return null;
  }

  return value;
}

function customerRoute(pathname: string): { customerId: string; conversation: boolean } | null {
  const match = /^\/api\/customers\/([^/]+)(\/conversation)?$/.exec(pathname);
  if (!match) {
    return null;
  }

  try {
    return {
      customerId: decodeURIComponent(match[1]),
      conversation: Boolean(match[2]),
    };
  } catch {
    return null;
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  service: AdminService,
): Promise<void> {
  if (request.method !== 'GET') {
    sendError(response, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    return;
  }

  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/api/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (url.pathname === '/api/dashboard/summary') {
    const limit = parseLimit(url, 5, 20);
    if (limit === null) {
      sendError(response, 400, 'INVALID_LIMIT', 'limit must be an integer between 1 and 20.');
      return;
    }
    sendJson(response, 200, await service.getSummary(limit));
    return;
  }

  if (url.pathname === '/api/appointments/upcoming') {
    const limit = parseLimit(url, 100, 100);
    if (limit === null) {
      sendError(response, 400, 'INVALID_LIMIT', 'limit must be an integer between 1 and 100.');
      return;
    }
    sendJson(response, 200, { appointments: await service.listUpcomingAppointments(limit) });
    return;
  }

  if (url.pathname === '/api/customers') {
    sendJson(response, 200, { customers: await service.listCustomers() });
    return;
  }

  const customer = customerRoute(url.pathname);
  if (customer) {
    if (customer.conversation) {
      sendJson(response, 200, { conversation: await service.getConversation(customer.customerId) });
      return;
    }

    sendJson(response, 200, { customer: await service.getCustomer(customer.customerId) });
    return;
  }

  sendError(response, 404, 'NOT_FOUND', 'Resource not found.');
}

export function createAdminHttpServer(service: AdminService): Server {
  return createServer((request, response) => {
    void handleRequest(request, response, service).catch((error: unknown) => {
      if (error instanceof AdminResourceNotFoundError) {
        sendError(response, 404, 'NOT_FOUND', error.message);
        return;
      }

      console.error('[Admin HTTP] Internal request error.');
      sendError(response, 500, 'INTERNAL_ERROR', 'Internal server error.');
    });
  });
}
