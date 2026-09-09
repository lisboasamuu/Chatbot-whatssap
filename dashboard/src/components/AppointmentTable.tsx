import type { ReactNode } from 'react';
import type { Appointment } from '../types';
import { EmptyState } from './AsyncState';

export function AppointmentTable({ appointments }: { appointments: Appointment[] }): ReactNode {
  if (appointments.length === 0) return <EmptyState message="Nenhum agendamento encontrado." />;

  return (
    <div className="min-w-0 rounded-2xl border border-brand-100 bg-white p-3 shadow-soft md:overflow-hidden md:p-0">
      <table className="w-full text-sm">
        <thead className="hidden border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-brand-900 md:table-header-group">
          <tr>
            <th className="px-4 py-3.5 font-semibold">ID</th>
            <th className="px-4 py-3.5 font-semibold">Cliente</th>
            <th className="px-4 py-3.5 font-semibold">Data</th>
            <th className="px-4 py-3.5 font-semibold">Horário</th>
          </tr>
        </thead>
        <tbody className="block space-y-3 bg-white md:table-row-group md:space-y-0 md:divide-y md:divide-slate-100">
          {appointments.map((appointment) => (
            <tr
              key={appointment.id}
              className="block rounded-xl border border-brand-100 bg-brand-50/35 p-4 transition hover:bg-brand-50 md:table-row md:rounded-none md:border-0 md:bg-white md:p-0"
            >
              <td className="block min-w-0 pb-3 font-mono text-xs text-slate-500 md:table-cell md:px-4 md:py-4">
                <span className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">ID</span>
                <span className="break-all">{appointment.id}</span>
              </td>
              <td className="block min-w-0 border-t border-brand-100 py-3 md:table-cell md:border-0 md:px-4 md:py-4">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Cliente</span>
                <div className="break-words font-medium text-slate-900">
                  {appointment.customerName ?? appointment.customerExternalId}
                </div>
                {appointment.customerName ? (
                  <div className="mt-0.5 break-all text-xs text-slate-500">{appointment.customerExternalId}</div>
                ) : null}
              </td>
              <td className="block border-t border-brand-100 py-3 text-slate-700 md:table-cell md:border-0 md:px-4 md:py-4">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Data</span>
                {formatDate(appointment.date)}
              </td>
              <td className="block border-t border-brand-100 pt-3 font-medium text-brand-900 md:table-cell md:border-0 md:px-4 md:py-4">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Horário</span>
                {appointment.time}
              </td>
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
