import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/appointments', label: 'Agendamentos' },
  { to: '/customers', label: 'Clientes' },
];

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Samuel Lisboa</p>
            <h1 className="text-xl font-semibold">ChatBot Whatssap</h1>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Navegação principal">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
