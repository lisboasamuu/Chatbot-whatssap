import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppointmentsPage } from './AppointmentsPage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppointmentsPage', () => {
  it('lists upcoming appointments returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          appointments: [
            {
              id: 'appointment-1',
              customerId: 'customer-1',
              customerExternalId: '5511999999999@c.us',
              customerName: 'João Silva',
              date: '2026-08-30',
              time: '09:00',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter>
        <AppointmentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('appointment-1')).toBeInTheDocument();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('5511999999999@c.us')).toBeInTheDocument();
    expect(screen.getByText('30/08/2026')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });
});
