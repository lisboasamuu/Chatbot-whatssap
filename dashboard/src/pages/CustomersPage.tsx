import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { api } from '../lib/api';
import type { Customer } from '../types';

export function CustomersPage(): ReactNode {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [feedback, setFeedback] = useState('');

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

  async function createCustomer(): Promise<void> {
    setFeedback('');
    try {
      const customer = await api.createCustomer({ name, phone });
      setCustomers((current) => current ? [customer, ...current.filter((item) => item.id !== customer.id)] : [customer]);
      setName(''); setPhone(''); setShowForm(false);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Não foi possível salvar o contato.');
    }
  }

  if (error) return <ErrorState message="Falha ao carregar os clientes." />;
  if (customers === null) return <LoadingState />;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <p className="brand-eyebrow">Base de atendimento</p>
        <h2 className="brand-page-title">Clientes e contatos</h2>
        <p className="mt-2 brand-muted">Pessoas atendidas pelo canal e contatos cadastrados para automações.</p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)} className="brand-button w-full sm:w-auto">+ Novo contato</button>
      </div>
      {showForm ? <section className="brand-card"><h3 className="font-semibold text-brand-900">Cadastrar contato</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Nome<input value={name} onChange={(event) => setName(event.target.value)} className="field" placeholder="João da Silva" maxLength={100} /></label><label className="text-sm font-medium text-slate-700">WhatsApp<input value={phone} onChange={(event) => setPhone(event.target.value)} className="field" placeholder="+55 11 99999-9999" inputMode="tel" /></label></div><p className="mt-3 text-xs leading-5 text-slate-500">Confira o número antes de salvar. As mensagens serão enviadas exatamente para o WhatsApp cadastrado; esta validação não confirma que o número existe ou pertence à pessoa.</p>{feedback ? <p role="alert" className="mt-2 text-sm text-red-700">{feedback}</p> : null}<div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void createCustomer()} className="brand-button">Salvar contato</button><button type="button" onClick={() => setShowForm(false)} className="brand-button-secondary">Cancelar</button></div></section> : null}
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
