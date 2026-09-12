import { ReactNode } from 'react';
import { LayoutDashboard } from 'lucide-react';

export default function OperationalPageIntro({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <header className="mb-4 w-full rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border semantic-panel-info"><LayoutDashboard size={22} /></span><div><p className="text-xs font-bold uppercase tracking-widest text-muted">KP Transportes · operação</p><h1 className="mt-1 text-xl font-black text-text sm:text-2xl">{title}</h1><p className="mt-2 max-w-3xl text-sm text-muted">{description}</p></div></div>
      {children}
    </div>
  </header>;
}
