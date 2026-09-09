import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DashboardPage', () => {
  it('shows loading state and then real summary cards', async () => {
    let resolveFetch!: (value: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Carregando dados');

    resolveFetch(
      new Response(
        JSON.stringify({
          totalCustomers: 4,
          appointmentsToday: 2,
          upcomingAppointments: 3,
          nextAppointments: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    expect(await screen.findByText('Total de clientes')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Agendamentos hoje')).toBeInTheDocument();
    expect(screen.getByText('Próximos agendamentos')).toBeInTheDocument();
    expect(screen.getByText('Nenhum agendamento encontrado.')).toBeInTheDocument();
  });

  it('shows API error without fallback data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'failure' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Falha ao carregar o dashboard.',
    );
    expect(screen.queryByText('Total de clientes')).not.toBeInTheDocument();
  });
});
