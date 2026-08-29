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
        <p className="text-sm text-slate-400">Base de atendimento</p>
        <h2 className="text-3xl font-semibold tracking-tight">Clientes</h2>
      </div>
      {customers.length === 0 ? (
        <EmptyState message="Nenhum cliente cadastrado." />
      ) : (
        <div className="grid gap-3">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              to={`/customers/${customer.id}`}
              className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-cyan-700 sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div>
                <p className="font-medium">{customer.externalId}</p>
                <p className="font-mono text-xs text-slate-500">{customer.id}</p>
              </div>
              <p className="text-sm text-slate-400">
                Criado em {new Date(customer.createdAt).toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-slate-300">
                {customer.appointmentCount} agendamento(s)
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
