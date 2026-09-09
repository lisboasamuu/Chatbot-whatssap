import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { AuthenticatedCompany } from '../types';

export function CompanyLogin({ onLogin }: { onLogin: (company: AuthenticatedCompany) => void }): ReactNode {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onLogin(await api.companyLogin(email, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-brand-50 px-4 py-8 text-slate-900 sm:place-items-center">
      <img
        src="/brand/codigo-ns-black.png"
        alt=""
        aria-hidden="true"
        className="brand-watermark absolute -bottom-40 -right-28 w-[620px] rotate-[-8deg]"
      />
      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-panel lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden min-h-[560px] overflow-hidden bg-brand-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm">
              <img src="/brand/codigo-ns-black.png" alt="Código NS" className="h-full w-full object-contain" />
            </div>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">Código NS</p>
            <h1 className="mt-3 max-w-sm text-4xl font-semibold leading-tight tracking-tight">
              Sua operação, conectada e organizada.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-brand-100">
              Acesse o ambiente exclusivo da sua empresa para acompanhar clientes, agendamentos e sua conexão WhatsApp.
            </p>
          </div>
          <div className="relative z-10 text-xs leading-5 text-brand-300">
            Ambiente empresarial protegido e isolado por empresa.
          </div>
          <img
            src="/brand/codigo-ns-black.png"
            alt=""
            aria-hidden="true"
            className="absolute -bottom-24 -right-20 w-[380px] opacity-[0.08] mix-blend-screen"
          />
        </section>

        <section className="flex items-center p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-brand-100 bg-white p-1 shadow-sm">
                <img src="/brand/codigo-ns-black.png" alt="Código NS" className="h-full w-full object-contain" />
              </div>
              <p className="mt-4 brand-eyebrow">Código NS</p>
            </div>
            <p className="brand-eyebrow">Acesso empresarial</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900">Acesse sua empresa</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Entre para acessar somente os dados e a conexão WhatsApp da sua empresa.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block text-sm font-medium text-slate-700">
                E-mail
                <input
                  autoFocus
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Senha
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field"
                />
              </label>
              {error ? (
                <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <button disabled={loading || !email || !password} className="brand-button w-full py-3">
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
			<p className="mt-6 text-center text-xs text-slate-400">
			Siga a gente no Instagram:{' '}
			<a
				href="https://www.instagram.com/codigonsbr"
				target="_blank"
				rel="noreferrer"
				className="font-medium text-brand-700 transition hover:text-brand-900"
			>
				@codigonsbr
			</a>
			</p>
          </div>
        </section>
      </div>
    </div>
  );
}
