import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { WhatsAppStatus } from '../types';

const LABEL: Record<WhatsAppStatus['state'], string> = {
  CONNECTED: 'Conectado',
  CONNECTING: 'Conectando',
  QR_REQUIRED: 'QR Code necessário',
  DISCONNECTED: 'Desconectado',
  ERROR: 'Erro',
};

function statusClasses(state: WhatsAppStatus['state'] | undefined): string {
  if (state === 'CONNECTED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'ERROR') return 'border-red-200 bg-red-50 text-red-700';
  if (state === 'DISCONNECTED') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function WhatsAppPage(): ReactNode {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const result = await api.getWhatsAppQr();
      setStatus(result.status);
      setQr(result.qr);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao consultar WhatsApp.');
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  async function connect() {
    setBusy(true);
    try {
      setStatus(await api.connectWhatsApp());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao conectar.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Desconectar este WhatsApp? O logout do dashboard não faz isso.')) return;
    setBusy(true);
    try {
      setStatus(await api.disconnectWhatsApp());
      setQr(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao desconectar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="brand-eyebrow">Canal da empresa</p>
        <h2 className="brand-page-title">WhatsApp</h2>
        <p className="mt-2 brand-muted">A conexão exibida aqui pertence exclusivamente à sua empresa.</p>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="brand-card relative overflow-hidden">
          <img src="/brand/codigo-ns-black.png" alt="" aria-hidden="true" className="brand-watermark absolute -bottom-14 -right-10 hidden w-48 sm:block sm:w-64" />
          <div className="relative z-10">
            <p className="brand-eyebrow">Código NS</p>
            <h3 className="mt-1 text-lg font-semibold text-brand-900">Status da sessão</h3>
            <div className={`mt-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${statusClasses(status?.state)}`}>
              <span className="h-2 w-2 rounded-full bg-current" />
              {status ? LABEL[status.state] : 'Carregando…'}
            </div>
            {status?.lastError ? <p className="mt-3 text-sm text-red-700">{status.lastError}</p> : null}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button disabled={busy} onClick={() => void connect()} className="brand-button w-full sm:w-auto">Conectar / reconectar</button>
              <button disabled={busy || !status?.enabled} onClick={() => void disconnect()} className="brand-button-danger w-full sm:w-auto">Desconectar WhatsApp</button>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">Sair do dashboard não desconecta o WhatsApp.</p>
          </div>
        </div>

        <div className="brand-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="brand-eyebrow">Autenticação</p>
              <h3 className="mt-1 text-lg font-semibold text-brand-900">QR Code</h3>
            </div>
          </div>
          {qr ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <img src={qr} alt="QR Code para conectar o WhatsApp" className="mx-auto aspect-square w-full max-w-xs" />
            </div>
          ) : (
            <div className="relative mt-4 grid min-h-64 overflow-hidden rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-6 text-center text-sm text-slate-500">
              <img src="/brand/codigo-ns-black.png" alt="" aria-hidden="true" className="brand-watermark absolute -bottom-14 -right-8 hidden w-44 sm:block sm:w-56" />
              <p className="relative z-10 m-auto max-w-xs">
                {status?.state === 'CONNECTED'
                  ? 'Sessão já autenticada. Nenhum QR necessário.'
                  : 'O QR aparecerá aqui quando o WhatsApp solicitar autenticação.'}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
