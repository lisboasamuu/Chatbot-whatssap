import type { ReactNode } from 'react';

export function LoadingState(): ReactNode {
  return (
    <div role="status" className="brand-card flex items-center gap-3 text-slate-600">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" />
      Carregando dados…
    </div>
  );
}

export function ErrorState({ message }: { message: string }): ReactNode {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
      <p className="font-semibold">Não foi possível concluir a operação</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }): ReactNode {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-brand-300 bg-white p-7 text-slate-500">
      <img
        src="/brand/codigo-ns-black.png"
        alt=""
        aria-hidden="true"
        className="brand-watermark absolute -bottom-16 -right-12 w-48"
      />
      <p className="relative z-10 text-sm">{message}</p>
    </div>
  );
}
