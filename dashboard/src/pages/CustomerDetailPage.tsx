import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppointmentTable } from '../components/AppointmentTable';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { api } from '../lib/api';
import type { Conversation, CustomerDetail } from '../types';

interface DetailState {
  customer: CustomerDetail;
  conversation: Conversation | null;
}

export function CustomerDetailPage(): ReactNode {
  const { customerId } = useParams();
  const [state, setState] = useState<DetailState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setError(true);
      return;
    }

    let active = true;
    Promise.all([api.getCustomer(customerId), api.getConversation(customerId)])
      .then(([customer, conversation]) => {
        if (active) setState({ customer, conversation });
      })
      .catch(() => active && setError(true));

    return () => {
      active = false;
    };
  }, [customerId]);

  if (error) return <ErrorState message="Não foi possível carregar o cliente." />;
  if (!state) return <LoadingState />;

  const { customer, conversation } = state;

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Link to="/customers" className="brand-link text-sm">← Voltar para clientes</Link>
        <div>
          <p className="brand-eyebrow">Perfil do cliente</p>
          <h2 className="brand-page-title">{customer.name ?? customer.externalId}</h2>
        </div>
        <div className="grid gap-2 rounded-2xl border border-brand-100 bg-white p-4 text-sm text-slate-500 shadow-sm sm:grid-cols-2">
          {customer.name ? <p>WhatsApp: <span className="font-medium text-slate-700">{customer.externalId}</span></p> : null}
          <p>ID: <span className="break-all font-mono text-xs text-slate-700">{customer.id}</span></p>
          <p>Criado em: <span className="text-slate-700">{new Date(customer.createdAt).toLocaleString('pt-BR')}</span></p>
          <p>Atualizado em: <span className="text-slate-700">{new Date(customer.updatedAt).toLocaleString('pt-BR')}</span></p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-brand-900">Agendamentos</h3>
        <AppointmentTable appointments={customer.appointments} />
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-brand-900">Histórico da conversa</h3>
        {!conversation || conversation.messages.length === 0 ? (
          <EmptyState message="Nenhuma mensagem registrada para este cliente." />
        ) : (
          <div className="space-y-3">
            {conversation.messages.map((message) => (
              <article
                key={message.id}
                className={`w-full max-w-3xl overflow-hidden rounded-2xl border p-4 shadow-sm ${
                  message.direction === 'INBOUND'
                    ? 'mr-auto border-slate-200 bg-white'
                    : 'ml-auto border-brand-100 bg-brand-100/70'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      message.direction === 'INBOUND'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-brand-700 text-white'
                    }`}
                  >
                    {message.direction}
                  </span>
                  <time className="text-xs text-slate-400">{new Date(message.createdAt).toLocaleString('pt-BR')}</time>
                </div>
                <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{message.body}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
