import type { DetailedHTMLProps, HTMLAttributes, InputHTMLAttributes, ButtonHTMLAttributes } from 'react';
import VolksImage from '../../assets/images/volks.png';
import { cn } from '../../lib/cn';

type SectionProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type AsideProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type SpanProps = DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
type H1Props = DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
type H2Props = DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
type PProps = DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
type InputProps = InputHTMLAttributes<HTMLInputElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Container({ className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        'relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-bg px-s4 py-s5',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-accent"
      />
      {children}
    </section>
  );
}

export function LoginCard({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'relative z-[1] grid min-h-[640px] w-[min(1080px,94vw)] grid-cols-[1.08fr_0.92fr] overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-3)] max-[950px]:min-h-0 max-[950px]:w-[min(560px,94vw)] max-[950px]:grid-cols-1',
        className,
      )}
      {...props}
    />
  );
}

export function HeroPanel({ className, ...props }: AsideProps) {
  return (
    <aside
      className={cn(
        'relative flex min-h-[420px] flex-col justify-end gap-s4 border-r border-border p-s8 max-[950px]:min-h-[300px] max-[950px]:border-b max-[950px]:border-r-0 max-[950px]:p-s6 max-[560px]:min-h-[260px] max-[560px]:p-s5',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(7, 15, 28, 0.12) 0%, rgba(7, 15, 28, 0.92) 82%), url(${VolksImage})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
      {...props}
    >
      {props.children}
    </aside>
  );
}

export function HeroBadge({ className, ...props }: SpanProps) {
  return (
    <span
      className={cn(
        'relative z-[1] w-fit rounded-sm border border-blue-300/40 bg-[#0f172a] px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-blue-100',
        className,
      )}
      {...props}
    />
  );
}

export function HeroTitle({ className, children, ...props }: H1Props) {
  return (
    <h1
      className={cn('relative z-[1] block max-w-[440px] text-[clamp(1.6rem,1.25rem+1.2vw,2.45rem)] leading-[1.15] text-white', className)}
      {...props}
    >
      {children}
    </h1>
  );
}

export function HeroDescription({ className, ...props }: PProps) {
  return <p className={cn('relative z-[1] max-w-[420px] text-[0.95rem] leading-[1.6] text-slate-200', className)} {...props} />;
}

export function BoxLogin({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-full w-full flex-col justify-center bg-surface p-s8 max-[950px]:min-h-0 max-[950px]:p-s6 max-[560px]:p-s5',
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLogin({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'h-12 w-full cursor-pointer rounded-md border border-accent-strong bg-accent text-sm font-bold text-white shadow-soft transition-colors duration-200 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
        className,
      )}
      {...props}
    />
  );
}

export function BoxInput({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col gap-s2 [&_label]:mt-1 [&_label]:text-xs [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-wide [&_label]:text-muted', className)} {...props} />;
}

export function InputLogin({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-md border border-border bg-card px-4 text-text outline-none transition placeholder:text-muted focus:border-accent focus:shadow-[0_0_0_3px_rgba(37,99,235,0.18)]',
        className,
      )}
      {...props}
    />
  );
}

export function BoxPassword({ className, ...props }: DivProps) {
  return <div className={cn('relative flex w-full [&_svg]:absolute [&_svg]:right-[14px] [&_svg]:top-1/2 [&_svg]:-translate-y-1/2 [&_svg]:cursor-pointer [&_svg]:text-muted', className)} {...props} />;
}

export function FormHeader({ className, ...props }: DivProps) {
  return <div className={cn('mb-s6 flex flex-col gap-s2', className)} {...props} />;
}

export function BrandName({ className, ...props }: SpanProps) {
  return (
    <span
      className={cn(
        'w-fit border-l-4 border-accent pl-3 text-[0.75rem] font-bold uppercase tracking-[0.12em] text-text-accent',
        className,
      )}
      {...props}
    />
  );
}

export function FormTitle({ className, children, ...props }: H2Props) {
  return (
    <h2 className={cn('block text-[clamp(1.4rem,1.1rem+0.9vw,2rem)] leading-[1.15] text-text', className)} {...props}>
      {children}
    </h2>
  );
}

export function FormSubtitle({ className, ...props }: PProps) {
  return <p className={cn('max-w-[340px] text-[0.93rem] leading-[1.5] text-muted', className)} {...props} />;
}

export function LoginForm({ className, ...props }: DivProps) {
  return <div className={cn('flex w-[min(100%,340px)] flex-col gap-s4', className)} {...props} />;
}

export function ErrorText({ className, ...props }: SpanProps) {
  return <span className={cn('mt-[2px] rounded-sm border semantic-panel-danger px-3 py-2 text-[0.84rem] font-semibold', className)} {...props} />;
}

export function SupportText({ className, ...props }: SpanProps) {
  return <span className={cn('border-t border-border pt-4 text-center text-[0.78rem] text-muted', className)} {...props} />;
}
