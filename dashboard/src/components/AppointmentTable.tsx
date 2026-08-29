import type { ReactNode } from 'react';
import type { Appointment } from '../types';
import { EmptyState } from './AsyncState';

export function AppointmentTable({
  appointments,
}: {
  appointments: Appointment[];
}): ReactNode {
  if (appointments.length === 0) {
    return <EmptyState message="Nenhum agendamento encontrado." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900 text-left text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">ID</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Data</th>
            <th className="px-4 py-3 font-medium">Horário</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950">
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">{appointment.id}</td>
              <td className="px-4 py-3">
                <div className="font-medium">
                  {appointment.customerName ?? appointment.customerExternalId}
                </div>
                {appointment.customerName ? (
                  <div className="text-xs text-slate-500">
                    {appointment.customerExternalId}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3">{formatDate(appointment.date)}</td>
              <td className="px-4 py-3">{appointment.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}
