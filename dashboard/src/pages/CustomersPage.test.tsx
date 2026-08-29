import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomersPage } from './CustomersPage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CustomersPage', () => {
  it('shows empty state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ customers: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nenhum cliente cadastrado.')).toBeInTheDocument();
  });

  it('lists customer and appointment count', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          customers: [
            {
              id: 'customer-1',
              externalId: '5511999999999@c.us',
              createdAt: '2026-08-29T12:00:00.000Z',
              appointmentCount: 2,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('5511999999999@c.us')).toBeInTheDocument();
    expect(screen.getByText('2 agendamento(s)')).toBeInTheDocument();
  });
});
