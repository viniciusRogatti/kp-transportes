import { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, FileSearch, LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export function WorkspaceButton({ primary = false, className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type={type} className={cn('workspace-button', primary && 'workspace-button-primary', className)} {...props} />;
}

export function WorkspaceHeader({ title, description, eyebrow, children }: { title: string; description: string; eyebrow?: string; children?: ReactNode }) {
  return <header className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">{eyebrow}</p>}
      <h1 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
    </div>
    {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
  </header>;
}

export function WorkspaceState({ kind, title, children, action }: { kind: 'loading' | 'empty' | 'error'; title: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = kind === 'loading' ? LoaderCircle : kind === 'error' ? AlertCircle : FileSearch;
  return <section role={kind === 'error' ? 'alert' : 'status'} className="w-full rounded-2xl border border-border bg-card px-4 py-10 text-center">
    <Icon aria-hidden="true" className={cn('mx-auto mb-3 h-7 w-7', kind === 'error' ? 'text-danger' : 'text-muted', kind === 'loading' && 'animate-spin motion-reduce:animate-none')} />
    <h2 className="text-base font-semibold text-text">{title}</h2>
    {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </section>;
}
