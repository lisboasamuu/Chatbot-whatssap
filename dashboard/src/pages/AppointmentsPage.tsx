import { useEffect, useState, type ReactNode } from 'react';
import { AppointmentTable } from '../components/AppointmentTable';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { api } from '../lib/api';
import type { Appointment } from '../types';

export function AppointmentsPage(): ReactNode {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getUpcomingAppointments()
      .then((data) => active && setAppointments(data))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <p className="brand-eyebrow">Agenda futura</p>
        <h2 className="brand-page-title">Agendamentos</h2>
        <p className="mt-2 brand-muted">Consulte os próximos compromissos registrados pelo atendimento.</p>
      </div>
      {error ? (
        <ErrorState message="Falha ao carregar os agendamentos." />
      ) : appointments === null ? (
        <LoadingState />
      ) : (
        <AppointmentTable appointments={appointments} />
      )}
    </section>
  );
}
