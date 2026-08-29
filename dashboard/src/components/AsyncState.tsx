import type { ReactNode } from 'react';

export function LoadingState(): ReactNode {
  return (
    <div role="status" className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
      Carregando dados…
    </div>
  );
}

export function ErrorState({ message }: { message: string }): ReactNode {
  return (
    <div role="alert" className="rounded-xl border border-red-900 bg-red-950/40 p-6 text-red-200">
      {message}
    </div>
  );
}

export function EmptyState({ message }: { message: string }): ReactNode {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-slate-400">
      {message}
    </div>
  );
}
