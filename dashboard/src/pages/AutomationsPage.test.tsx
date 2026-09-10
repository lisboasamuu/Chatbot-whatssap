import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomationsPage } from './AutomationsPage';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.restoreAllMocks());

describe('AutomationsPage', () => {
  it('lists inbound and scheduled automations with delivery summary', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/customers')) return json({ customers: [] });
      return json({ automations: [
        {
          id: 'a1', name: 'Serviços', type: 'INBOUND', isActive: true,
          responseBody: 'Resposta', messageBody: null, scheduleType: null,
          oneTimeDate: null, oneTimeTime: null, weekdays: [], times: [], nextRunAt: null,
          variations: [{ id: 'v1', value: 'serviços', normalizedValue: 'servicos' }],
          recipients: [], runs: [], createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
        },
        {
          id: 'a2', name: 'Promoções', type: 'SCHEDULED', isActive: true,
          responseBody: null, messageBody: 'Mensagem', scheduleType: 'WEEKLY',
          oneTimeDate: null, oneTimeTime: null, weekdays: ['MONDAY', 'SUNDAY'], times: ['09:00'], nextRunAt: null,
          variations: [], recipients: [], runs: [{ id: 'r1', scheduledFor: '2030-01-01T00:00:00Z', status: 'PARTIAL', totalRecipients: 2, sentCount: 1, failedCount: 1, completedAt: '2030-01-01T00:01:00Z' }],
          createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
        },
      ] });
    });
    render(<MemoryRouter><AutomationsPage /></MemoryRouter>);
    expect(await screen.findByText('Serviços')).toBeInTheDocument();
    expect(screen.getByText('Promoções')).toBeInTheDocument();
    expect(screen.getByText(/1 enviada\(s\).*1 não enviada\(s\)/)).toBeInTheDocument();
  });

  it('enforces the ten-variation limit in the form', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/api/customers')) return json({ customers: [] });
      return json({ automations: [] });
    });
    const user = userEvent.setup();
    render(<MemoryRouter><AutomationsPage /></MemoryRouter>);
    await screen.findByText('Nenhuma automação ainda');
    await user.click(screen.getByRole('button', { name: '+ Nova automação' }));
    const add = screen.getByRole('button', { name: '+ Adicionar variação' });
    for (let count = 1; count < 10; count += 1) await user.click(add);
    expect(screen.getByText('10/10')).toBeInTheDocument();
    expect(add).toBeDisabled();
  });
});
