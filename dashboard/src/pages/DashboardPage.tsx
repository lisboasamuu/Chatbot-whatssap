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
    ['Total de clientes', summary.totalCustomers],
    ['Agendamentos hoje', summary.appointmentsToday],
    ['Próximos agendamentos', summary.upcomingAppointments],
  ];

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">Visão operacional</p>
        <h2 className="text-3xl font-semibold tracking-tight">Dashboard</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Próximos horários</h3>
        <AppointmentTable appointments={summary.nextAppointments} />
      </div>
    </section>
  );
}
