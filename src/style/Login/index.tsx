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
        'relative flex h-[100dvh] w-full items-center justify-center overflow-hidden px-s4 py-0',
        className,
      )}
      style={{
        background:
          'radial-gradient(920px 460px at -10% -10%, rgba(39, 198, 179, 0.23) 0%, transparent 70%), radial-gradient(780px 360px at 105% 0%, rgba(14, 93, 174, 0.2) 0%, transparent 70%), linear-gradient(140deg, #051320 0%, #0b243a 60%, #0e2d45 100%)',
      }}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(76, 122, 163, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(76, 122, 163, 0.08) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.22), transparent 75%)',
        }}
      />
      {children}
    </section>
  );
}

export function LoginCard({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'relative z-[1] grid h-[min(680px,92dvh)] w-[min(1080px,94vw)] grid-cols-2 overflow-hidden rounded-[26px] border border-[#7aacd63d] shadow-[0_22px_48px_rgba(0,0,0,0.35)] backdrop-blur-[8px] max-[950px]:h-auto max-[950px]:w-[min(560px,94vw)] max-[950px]:grid-cols-1',
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
        'relative flex min-h-[420px] flex-col justify-end gap-s4 p-s8 max-[950px]:min-h-[300px] max-[950px]:p-s6 max-[560px]:min-h-[260px] max-[560px]:p-s5',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(to top, rgba(4, 14, 26, 0.78), rgba(8, 25, 41, 0.35)), url(${VolksImage})`,
        backgroundPosition: 'right',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
      }}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(130deg, rgba(39, 198, 179, 0.12), transparent 62%)' }}
      />
      {props.children}
    </aside>
  );
}

export function HeroBadge({ className, ...props }: SpanProps) {
  return (
    <span
      className={cn(
        'relative z-[1] w-fit rounded-full border border-[#d5faff59] bg-[#04121f8f] px-[14px] py-2 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#dff8ff]',
        className,
      )}
      {...props}
    />
  );
}

export function HeroTitle({ className, children, ...props }: H1Props) {
  return (
    <h1
      className={cn('relative z-[1] block max-w-[420px] text-[clamp(1.5rem,1.2rem+1.1vw,2.3rem)] leading-[1.15] text-[#f5fbff] [text-shadow:0_10px_28px_rgba(0,0,0,0.35)]', className)}
      {...props}
    >
      {children}
    </h1>
  );
}

export function HeroDescription({ className, ...props }: PProps) {
  return <p className={cn('relative z-[1] max-w-[390px] text-[0.95rem] leading-[1.5] text-[#ebf7ffe6]', className)} {...props} />;
}

export function BoxLogin({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-full w-full flex-col justify-center p-s8 max-[950px]:min-h-0 max-[950px]:p-s6 max-[560px]:p-s5',
        className,
      )}
      style={{
        background:
          'radial-gradient(120% 140% at 0% 0%, rgba(22, 50, 74, 0.34) 0%, transparent 55%), radial-gradient(100% 120% at 100% 100%, rgba(12, 36, 56, 0.36) 0%, transparent 58%), linear-gradient(160deg, #061019 0%, #071827 55%, #0a2133 100%)',
      }}
      {...props}
    />
  );
}

export function ButtonLogin({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'h-12 w-full cursor-pointer rounded-xl border border-white/20 bg-gradient-to-br from-[#27c6b3] to-[#17a694] text-sm font-bold uppercase tracking-[0.03em] text-[#04131e] transition duration-200 hover:-translate-y-px hover:shadow-[0_12px_22px_rgba(18,198,179,0.2)] disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none',
        className,
      )}
      {...props}
    />
  );
}

export function BoxInput({ className, ...props }: DivProps) {
  return <div className={cn('flex w-full flex-col gap-s2', className)} {...props} />;
}

export function InputLogin({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'h-12 w-full rounded-xl border border-[#9cc5e84d] bg-[#081825cc] px-4 text-[#e8f5ff] outline-none transition placeholder:text-[#9cb5c9] focus:border-[#3ddfcdd9] focus:bg-[#0a1f30e6] focus:shadow-[0_0_0_4px_rgba(39,198,179,0.2)]',
        className,
      )}
      {...props}
    />
  );
}

export function BoxPassword({ className, ...props }: DivProps) {
  return <div className={cn('relative flex w-full [&_svg]:absolute [&_svg]:right-[14px] [&_svg]:top-1/2 [&_svg]:-translate-y-1/2 [&_svg]:cursor-pointer [&_svg]:text-[#a8c6df]', className)} {...props} />;
}

export function FormHeader({ className, ...props }: DivProps) {
  return <div className={cn('mb-s6 flex flex-col gap-s2', className)} {...props} />;
}

export function BrandName({ className, ...props }: SpanProps) {
  return (
    <span
      className={cn(
        'w-fit rounded-full border border-[#a6d5f757] bg-[#091e3180] px-3 py-[7px] text-[0.78rem] font-bold uppercase tracking-[0.1em] text-[#ddf5ff]',
        className,
      )}
      {...props}
    />
  );
}

export function FormTitle({ className, children, ...props }: H2Props) {
  return (
    <h2 className={cn('block text-[clamp(1.4rem,1.1rem+0.9vw,2rem)] leading-[1.15] text-[#f2fbff]', className)} {...props}>
      {children}
    </h2>
  );
}

export function FormSubtitle({ className, ...props }: PProps) {
  return <p className={cn('max-w-[340px] text-[0.93rem] leading-[1.45] text-[#9eb7ca]', className)} {...props} />;
}

export function LoginForm({ className, ...props }: DivProps) {
  return <div className={cn('flex w-[min(100%,340px)] flex-col gap-s4', className)} {...props} />;
}

export function ErrorText({ className, ...props }: SpanProps) {
  return <span className={cn('mt-[2px] text-[0.84rem] font-semibold text-[#ff9e9e]', className)} {...props} />;
}

export function SupportText({ className, ...props }: SpanProps) {
  return <span className={cn('text-center text-[0.8rem] text-[#7f9cb2]', className)} {...props} />;
}
