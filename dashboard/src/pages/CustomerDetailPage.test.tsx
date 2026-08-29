import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomerDetailPage } from './CustomerDetailPage';

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/customers/customer-1']}>
      <Routes>
        <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CustomerDetailPage', () => {
  it('shows customer, appointments and inbound/outbound messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      if (path.endsWith('/conversation')) {
        return new Response(
          JSON.stringify({
            conversation: {
              id: 'conversation-1',
              state: 'ACTIVE',
              createdAt: '2026-08-29T12:00:00.000Z',
              updatedAt: '2026-08-29T12:01:00.000Z',
              messages: [
                {
                  id: 'message-1',
                  direction: 'INBOUND',
                  body: 'Olá',
                  createdAt: '2026-08-29T12:00:00.000Z',
                },
                {
                  id: 'message-2',
                  direction: 'OUTBOUND',
                  body: 'Como posso ajudar?',
                  createdAt: '2026-08-29T12:00:01.000Z',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          customer: {
            id: 'customer-1',
            externalId: '5511999999999@c.us',
            createdAt: '2026-08-29T12:00:00.000Z',
            updatedAt: '2026-08-29T12:01:00.000Z',
            appointmentCount: 1,
            appointments: [
              {
                id: 'appointment-1',
                customerId: 'customer-1',
                customerExternalId: '5511999999999@c.us',
                date: '2026-08-30',
                time: '09:00',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    renderPage();

    expect(await screen.findByText('5511999999999@c.us')).toBeInTheDocument();
    expect(screen.getByText('30/08/2026')).toBeInTheDocument();
    expect(screen.getByText('INBOUND')).toBeInTheDocument();
    expect(screen.getByText('OUTBOUND')).toBeInTheDocument();
    expect(screen.getByText('Olá')).toBeInTheDocument();
    expect(screen.getByText('Como posso ajudar?')).toBeInTheDocument();
  });

  it('shows empty conversation state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      if (path.endsWith('/conversation')) {
        return new Response(JSON.stringify({ conversation: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          customer: {
            id: 'customer-1',
            externalId: '5511999999999@c.us',
            createdAt: '2026-08-29T12:00:00.000Z',
            updatedAt: '2026-08-29T12:01:00.000Z',
            appointmentCount: 0,
            appointments: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    renderPage();

    expect(
      await screen.findByText('Nenhuma mensagem registrada para este cliente.'),
    ).toBeInTheDocument();
  });
});
