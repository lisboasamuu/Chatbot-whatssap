import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { api } from '../lib/api';
import type { Company } from '../types';

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/appointments', label: 'Agendamentos' },
  { to: '/customers', label: 'Clientes' },
  { to: '/settings', label: 'Configurações' },
  { to: '/whatsapp', label: 'WhatsApp' },
];

export function AppShell({ children, onLogout }: { children: ReactNode; onLogout?: () => void }): ReactNode {
  const [company, setCompany] = useState<Company | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void api
      .getCurrentCompany()
      .then((currentCompany) => {
        if (active) setCompany(currentCompany);
      })
      .catch(() => {
        if (active) setCompany(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  function logout(): void {
    setMobileMenuOpen(false);
    onLogout?.();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-50 text-slate-900">
      <span className="sr-only">{company ? `Empresa: ${company.name}` : 'Empresa não identificada'}</span>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-brand-900 px-5 py-6 text-white lg:flex">
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center">
            <img src="/brand/codigo-ns-white.png" alt="Código NS" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <strong className="block text-base tracking-tight">Código NS</strong>
            <span className="text-xs text-brand-300">Painel da empresa</span>
            <a
              href="https://www.instagram.com/codigonsbr"
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-[10px] leading-4 text-brand-300 transition hover:text-white"
            >
              Instagram · @codigonsbr
            </a>
          </div>
        </div>

        <div className="relative z-10 mt-8 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">Empresa</p>
          <p className="mt-1 truncate text-sm font-medium text-white">{company ? company.name : 'Não identificada'}</p>
        </div>

        <nav className="relative z-10 mt-6 space-y-1" aria-label="Navegação principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white text-brand-900 shadow-sm' : 'text-brand-100 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative z-10 mt-auto space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-xs leading-5 text-brand-100">
            Atendimento, agenda e WhatsApp em um só lugar.
          </div>
          {onLogout ? (
            <button
              onClick={logout}
              className="w-full rounded-xl border border-white/15 px-3.5 py-2.5 text-left text-sm font-medium text-brand-100 transition hover:bg-white/10 hover:text-white"
            >
              Sair
            </button>
          ) : null}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-brand-100 bg-white p-1 shadow-sm">
                <img src="/brand/codigo-ns-black.png" alt="Código NS" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <strong className="block text-sm leading-5 text-brand-900">Código NS</strong>
                <span className="block max-w-[190px] truncate text-xs leading-4 text-slate-500 sm:max-w-sm">
                  {company ? company.name : 'Não identificada'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand-200 bg-white text-brand-900 shadow-sm transition hover:bg-brand-50 focus:outline-none focus:ring-4 focus:ring-brand-300/30"
              aria-label="Abrir menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de navegação">
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
            />
            <aside className="absolute inset-y-0 right-0 flex w-[min(88vw,320px)] flex-col overflow-y-auto bg-brand-900 p-5 text-white shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img src="/brand/codigo-ns-white.png" alt="Código NS" className="h-10 w-10 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <strong className="block text-sm">Código NS</strong>
                    <span className="block truncate text-xs text-brand-300">{company ? company.name : 'Não identificada'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 text-brand-100 transition hover:bg-white/10 hover:text-white"
                  aria-label="Fechar menu"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <nav className="mt-8 space-y-1.5" aria-label="Navegação principal móvel">
                {navigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-xl px-4 py-3 text-sm font-medium transition ${
                        isActive ? 'bg-white text-brand-900' : 'text-brand-100 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-auto space-y-3 pt-8">
                <a
                  href="https://www.instagram.com/codigonsbr"
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-white/10 px-4 py-3 text-xs text-brand-200 transition hover:bg-white/10 hover:text-white"
                >
                  Instagram · @codigonsbr
                </a>
                {onLogout ? (
                  <button
                    onClick={logout}
                    className="w-full rounded-xl border border-white/15 px-4 py-3 text-left text-sm font-medium text-brand-100 transition hover:bg-white/10 hover:text-white"
                  >
                    Sair
                  </button>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        <main className="relative min-h-screen overflow-hidden">
          <img
            src="/brand/codigo-ns-black.png"
            alt=""
            aria-hidden="true"
            className="brand-watermark absolute -right-24 top-12 hidden w-[430px] rotate-6 xl:block"
          />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
