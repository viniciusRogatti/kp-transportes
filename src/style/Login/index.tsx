import type {
  ButtonHTMLAttributes,
  CSSProperties,
  DetailedHTMLProps,
  FormHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
} from 'react';
import VolvoFallback from '../../assets/images/Volvo.png';
import VolvoLarge from '../../assets/images/volvo-login.webp';
import VolvoSmall from '../../assets/images/volvo-login-720.webp';
import { cn } from '../../lib/cn';

type SectionProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type AsideProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
type SpanProps = DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
type H1Props = DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
type H2Props = DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
type PProps = DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
type FormProps = DetailedHTMLProps<FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
type InputProps = InputHTMLAttributes<HTMLInputElement>;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Container({ className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn('login-scene relative min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto bg-[var(--login-background)] text-[var(--login-text-primary)]', className)}
      {...props}
    >
      <div aria-hidden="true" className="login-scene-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="login-scene-glow pointer-events-none absolute inset-0" />
      {children}
    </section>
  );
}

export function LoginCard({ className, ...props }: DivProps) {
  return (
    <div
      className={cn('login-stage login-panel-enter relative mx-auto min-h-[100dvh] w-full max-w-[1800px]', className)}
      {...props}
    />
  );
}

export function HeroPanel({ className, children, ...props }: AsideProps) {
  return (
    <aside className={cn('login-hero absolute inset-0 isolate overflow-hidden', className)} {...props}>
      <picture
        className="login-photo absolute -z-20 bg-[#07111f]"
        style={{
          '--login-photo-large': `url(${VolvoLarge})`,
          '--login-photo-small': `url(${VolvoSmall})`,
        } as CSSProperties}
      >
        <source type="image/webp" srcSet={`${VolvoSmall} 720w, ${VolvoLarge} 1086w`} sizes="(max-width: 760px) 100vw, 74vw" />
        <img
          src={VolvoFallback}
          alt="Caminhão Volvo da frota em ambiente operacional"
          className="login-photo-foreground h-full object-cover"
          loading="eager"
          decoding="async"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      </picture>
      <div aria-hidden="true" className="login-photo-tone absolute -z-10" />
      <div aria-hidden="true" className="login-photo-edge absolute -z-[5]" />
      {children}
    </aside>
  );
}

export function HeroBadge({ className, ...props }: SpanProps) {
  return <span className={cn('login-kicker w-fit text-[0.66rem] font-bold uppercase tracking-[0.2em] text-blue-200', className)} {...props} />;
}

export function HeroTitle({ className, children, ...props }: H1Props) {
  return <h1 className={cn('block max-w-[690px] text-[clamp(2rem,1.2rem+2.35vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.05em] text-white', className)} {...props}>{children}</h1>;
}

export function HeroDescription({ className, ...props }: PProps) {
  return <p className={cn('max-w-[570px] text-[0.92rem] leading-7 text-slate-200 sm:text-base', className)} {...props} />;
}

export function BoxLogin({ className, ...props }: DivProps) {
  return (
    <div className={cn('login-document relative z-30 flex w-[min(430px,calc(100vw-32px))] flex-col justify-center px-9 py-10 text-[var(--login-text-primary)]', className)} {...props} />
  );
}

export function ButtonLogin({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'login-submit inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-transparent bg-[var(--login-accent)] px-4 text-sm font-bold text-white shadow-[0_10px_26px_rgba(29,78,216,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--login-accent-hover)] hover:shadow-[0_14px_30px_rgba(29,78,216,0.3)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none motion-reduce:transform-none',
        className,
      )}
      {...props}
    />
  );
}

export function BoxInput({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col gap-2 [&_label]:mt-1 [&_label]:text-xs [&_label]:font-bold [&_label]:tracking-wide [&_label]:text-[var(--login-text-primary)]', className)} {...props} />;
}

export function InputLogin({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'login-input h-12 w-full rounded-md border border-[var(--login-input-border)] bg-[var(--login-input-background)] px-4 text-[var(--login-text-primary)] caret-[var(--login-accent)] outline-none transition placeholder:text-[var(--login-text-secondary)] focus:border-[var(--login-accent)] focus:shadow-[0_0_0_4px_var(--login-input-focus)] disabled:cursor-not-allowed disabled:opacity-65',
        className,
      )}
      {...props}
    />
  );
}

export function BoxPassword({ className, ...props }: DivProps) {
  return <div className={cn('relative flex w-full', className)} {...props} />;
}

export function PasswordToggle({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn('absolute right-1.5 top-1/2 z-[1] inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--login-text-secondary)] transition hover:bg-surface-2 hover:text-[var(--login-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--login-accent)]', className)}
      {...props}
    />
  );
}

export function FormHeader({ className, ...props }: DivProps) {
  return <div className={cn('login-form-header mb-6 flex flex-col gap-2', className)} {...props} />;
}

export function BrandName({ className, ...props }: SpanProps) {
  return <span className={cn('text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--login-accent)]', className)} {...props} />;
}

export function FormTitle({ className, children, ...props }: H2Props) {
  return <h2 className={cn('block text-[clamp(1.55rem,1.25rem+0.7vw,1.95rem)] font-bold leading-tight tracking-[-0.03em] text-[var(--login-text-primary)]', className)} {...props}>{children}</h2>;
}

export function FormSubtitle({ className, ...props }: PProps) {
  return <p className={cn('max-w-[390px] text-[0.86rem] leading-6 text-[var(--login-text-secondary)]', className)} {...props} />;
}

export function LoginForm({ className, ...props }: FormProps) {
  return <form className={cn('flex w-full flex-col gap-4', className)} {...props} />;
}

export function ErrorText({ className, ...props }: PProps) {
  return <p role="alert" aria-live="assertive" className={cn('mt-1 rounded-md border semantic-panel-danger px-3 py-2.5 text-[0.82rem] font-semibold leading-5', className)} {...props} />;
}

export function SupportText({ className, ...props }: SpanProps) {
  return <span className={cn('border-t border-[var(--login-border)] pt-4 text-center text-[0.73rem] leading-5 text-[var(--login-text-secondary)]', className)} {...props} />;
}
