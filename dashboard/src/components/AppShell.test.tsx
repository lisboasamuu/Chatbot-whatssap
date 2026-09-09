import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppShell', () => {
  it('shows the company selected by the trusted backend context', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          company: { id: 'company-a', name: 'Company A' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empresa: Company A')).toBeInTheDocument();
  });

  it('does not invent a company when the backend cannot resolve it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'unavailable' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter>
        <AppShell>
          <div>Content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Empresa não identificada')).toBeInTheDocument();
  });
});
