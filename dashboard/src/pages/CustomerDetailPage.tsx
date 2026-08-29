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
      <div className="space-y-2">
        <Link to="/customers" className="text-sm text-cyan-400 hover:underline">
          ← Voltar para clientes
        </Link>
        <h2 className="text-3xl font-semibold tracking-tight">{customer.externalId}</h2>
        <div className="grid gap-1 text-sm text-slate-400">
          <p>ID: <span className="font-mono">{customer.id}</span></p>
          <p>Criado em: {new Date(customer.createdAt).toLocaleString('pt-BR')}</p>
          <p>Atualizado em: {new Date(customer.updatedAt).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Agendamentos</h3>
        <AppointmentTable appointments={customer.appointments} />
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Histórico da conversa</h3>
        {!conversation || conversation.messages.length === 0 ? (
          <EmptyState message="Nenhuma mensagem registrada para este cliente." />
        ) : (
          <div className="space-y-3">
            {conversation.messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-3xl rounded-xl border p-4 ${
                  message.direction === 'INBOUND'
                    ? 'mr-auto border-slate-700 bg-slate-900'
                    : 'ml-auto border-cyan-900 bg-cyan-950/50'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      message.direction === 'INBOUND'
                        ? 'bg-slate-700 text-slate-200'
                        : 'bg-cyan-400 text-slate-950'
                    }`}
                  >
                    {message.direction}
                  </span>
                  <time className="text-xs text-slate-500">
                    {new Date(message.createdAt).toLocaleString('pt-BR')}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
