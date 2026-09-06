import { useEffect, useState, type ReactNode } from 'react';
import { AppointmentTable } from '../components/AppointmentTable';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { api } from '../lib/api';
import type { DashboardSummary } from '../types';

export function DashboardPage(): ReactNode {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getSummary()
      .then((data) => active && setSummary(data))
      .catch(() => active && setError('Falha ao carregar o dashboard.'));
    return () => {
      active = false;
    };
  }, []);

  if (error) return <ErrorState message={error} />;
  if (!summary) return <LoadingState />;

  const cards = [
    ['Total de clientes', summary.totalCustomers, 'Base de relacionamento'],
    ['Agendamentos hoje', summary.appointmentsToday, 'Movimento do dia'],
    ['Próximos agendamentos', summary.upcomingAppointments, 'Agenda futura'],
  ];

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="brand-eyebrow">Visão operacional</p>
          <h2 className="brand-page-title">Dashboard</h2>
          <p className="mt-2 brand-muted">Acompanhe os principais números da operação da sua empresa.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, caption]) => (
          <article key={String(label)} className="brand-card relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-brand-700" />
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-900">{value}</p>
            <p className="mt-2 text-xs text-slate-400">{caption}</p>
          </article>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <p className="brand-eyebrow">Agenda</p>
          <h3 className="mt-1 text-lg font-semibold text-brand-900">Próximos horários</h3>
        </div>
        <AppointmentTable appointments={summary.nextAppointments} />
      </div>
    </section>
  );
}
