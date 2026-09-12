import type { ButtonHTMLAttributes, FormHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'react';
import { useLayoutEffect, useRef } from 'react';
import VolvoFallback from '../../assets/images/Volvo.png';
import VolvoLarge from '../../assets/images/volvo-login.webp';
import VolvoSmall from '../../assets/images/volvo-login-720.webp';
import WarehousePanorama from '../../assets/images/volvo-warehouse-panorama-v1.png';
import { cn } from '../../lib/cn';
import './login.css';

type BlockProps = HTMLAttributes<HTMLElement>;

export function Container({ className, children, ...props }: BlockProps) {
  const sceneRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const root = document.documentElement;
    const alreadyLocked = root.classList.contains('kp-login-viewport');
    root.classList.add('kp-login-viewport');
    const viewport = window.visualViewport;
    let frame = 0;

    const updateViewport = () => {
      frame = 0;
      scene.style.setProperty('--login-viewport-width', `${viewport?.width ?? window.innerWidth}px`);
      scene.style.setProperty('--login-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      scene.style.setProperty('--login-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      scene.style.setProperty('--login-viewport-left', `${viewport?.offsetLeft ?? 0}px`);
    };
    const scheduleViewport = () => {
      if (!frame) frame = window.requestAnimationFrame(updateViewport);
    };

    updateViewport();
    window.addEventListener('resize', scheduleViewport);
    viewport?.addEventListener('resize', scheduleViewport);
    viewport?.addEventListener('scroll', scheduleViewport);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', scheduleViewport);
      viewport?.removeEventListener('resize', scheduleViewport);
      viewport?.removeEventListener('scroll', scheduleViewport);
      if (!alreadyLocked) root.classList.remove('kp-login-viewport');
    };
  }, []);

  return (
    <main ref={sceneRef} className={cn('login-scene', className)} {...props}>
      <div className="login-backdrop" aria-hidden="true" style={{ backgroundImage: `linear-gradient(180deg, rgba(6, 15, 25, .28), rgba(6, 15, 25, .64)), url(${WarehousePanorama})` }} />
      {children}
    </main>
  );
}

export function LoginCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const fit = fitRef.current;
    const stage = stageRef.current;
    if (!viewport || !fit || !stage) return;
    let frame = 0;
    let previousScale = '';

    const updateFit = () => {
      frame = 0;
      // offset/scroll dimensions are unscaled: observing the result cannot feed back into the measurement.
      const naturalWidth = Math.max(stage.offsetWidth, stage.scrollWidth);
      const naturalHeight = Math.max(stage.offsetHeight, stage.scrollHeight);
      if (!naturalWidth || !naturalHeight || !viewport.clientWidth || !viewport.clientHeight) return;
      const scale = Math.min(1, Math.max(1, viewport.clientWidth - 2) / naturalWidth, Math.max(1, viewport.clientHeight - 2) / naturalHeight);
      const nextScale = String(Math.floor(scale * 1000000) / 1000000);
      if (nextScale === previousScale) return;
      previousScale = nextScale;
      fit.style.setProperty('--login-fit-scale', nextScale);
    };
    const scheduleFit = () => {
      if (!frame) frame = window.requestAnimationFrame(updateFit);
    };

    updateFit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleFit);
    observer?.observe(viewport);
    observer?.observe(stage);
    window.addEventListener('resize', scheduleFit);
    window.visualViewport?.addEventListener('resize', scheduleFit);
    stage.addEventListener('toggle', scheduleFit, true);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleFit);
      window.visualViewport?.removeEventListener('resize', scheduleFit);
      stage.removeEventListener('toggle', scheduleFit, true);
    };
  }, []);

  return (
    <div ref={viewportRef} className="login-card-viewport">
      <div ref={fitRef} className="login-card-fit">
        <div ref={stageRef} className={cn('login-stage', className)} {...props} />
      </div>
    </div>
  );
}

export function HeroPanel({ className, children, ...props }: BlockProps) {
  return (
    <aside className={cn('login-hero', className)} {...props}>
      <picture className="login-photo">
        <source type="image/webp" srcSet={`${VolvoSmall} 720w, ${VolvoLarge} 1086w`} sizes="(max-width: 760px) 100vw, (max-width: 1280px) 52vw, 620px" />
        <img src={VolvoFallback} alt="Caminhão Volvo da frota em ambiente operacional" width={1086} height={1448} loading="eager" decoding="async" />
      </picture>
      <div className="login-photo-tone" aria-hidden="true" />
      {children}
    </aside>
  );
}

export function HeroBadge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('login-kicker', className)} {...props} />;
}

export function HeroTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('login-hero-title', className)} {...props}>{children}</h2>;
}

export function BoxLogin({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('login-access', className)} {...props} />;
}

export function FormHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('login-form-header', className)} {...props} />;
}

export function FormTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn('login-form-title', className)} {...props}>{children}</h1>;
}

export function FormSubtitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('login-form-subtitle', className)} {...props} />;
}

export function LoginForm({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={cn('login-form', className)} {...props} />;
}

export function BoxInput({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('login-field', className)} {...props} />;
}

export function BoxPassword({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('login-field-wrap', className)} {...props} />;
}

export function InputLogin({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('login-input', className)} {...props} />;
}

export function PasswordToggle({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('login-password-toggle', className)} {...props} />;
}

export function ButtonLogin({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('login-submit', className)} {...props} />;
}

export function ErrorText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p role="alert" aria-live="assertive" className={cn('login-error', className)} {...props} />;
}

export function SupportText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('login-security-note', className)} {...props} />;
}
