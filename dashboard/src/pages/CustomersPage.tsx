import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { api } from '../lib/api';
import type { Customer } from '../types';

export function CustomersPage(): ReactNode {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getCustomers()
      .then((data) => active && setCustomers(data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  if (error) return <ErrorState message="Falha ao carregar os clientes." />;
  if (customers === null) return <LoadingState />;

  return (
    <section className="space-y-6">
      <div>
        <p className="brand-eyebrow">Base de atendimento</p>
        <h2 className="brand-page-title">Clientes</h2>
        <p className="mt-2 brand-muted">Histórico e relacionamento dos clientes atendidos pelo canal.</p>
      </div>
      {customers.length === 0 ? (
        <EmptyState message="Nenhum cliente cadastrado." />
      ) : (
        <div className="grid gap-3">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              to={`/customers/${customer.id}`}
              className="grid gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="font-semibold text-brand-900">{customer.name ?? customer.externalId}</p>
                {customer.name ? <p className="mt-0.5 text-sm text-slate-500">{customer.externalId}</p> : null}
                <p className="mt-1 break-all font-mono text-xs text-slate-400">{customer.id}</p>
              </div>
              <p className="text-sm text-slate-500">Criado em {new Date(customer.createdAt).toLocaleString('pt-BR')}</p>
              <span className="inline-flex w-fit rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-900">
                {customer.appointmentCount} agendamento(s)
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
