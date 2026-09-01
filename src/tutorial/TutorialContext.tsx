import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Pause, Play, RotateCcw, X } from 'lucide-react';
import {
  completeTutorialProgress,
  getCurrentTutorialProgress,
  isRetryableTutorialSyncError,
  pauseTutorialProgress,
  TutorialProgress,
  updateTutorialProgress,
} from '../services/tutorialProgressService';
import {
  findTutorialModuleByPath,
  getTutorialModulesForPermission,
  TutorialModule,
  TutorialStep,
} from './tutorialConfig';

type ActiveTour = { mode: 'full' | 'page'; moduleIndex: number; stepIndex: number; persist?: boolean };
type TutorialContextValue = {
  openPageHelp: () => void;
  startPageGuide: () => void;
  startFullTutorial: () => void;
  progress: TutorialProgress | null;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);
const TUTORIAL_BACKUP_KEY = 'tutorial_progress_backup';

const readTutorialBackup = (): Partial<TutorialProgress> | null => {
  try {
    const raw = localStorage.getItem(TUTORIAL_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    localStorage.removeItem(TUTORIAL_BACKUP_KEY);
    return null;
  }
};

const writeTutorialBackup = (next: Partial<TutorialProgress>) => {
  const current = readTutorialBackup() || {};
  localStorage.setItem(TUTORIAL_BACKUP_KEY, JSON.stringify({ ...current, ...next }));
};

const isVisibleElement = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const firstVisible = (selector: string, root: ParentNode = document) => (
  Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isVisibleElement) || null
);

const findControlCluster = (kind: 'filters' | 'actions') => {
  const pageRoot = firstVisible('[data-tutorial="page-content"]') || firstVisible('main') || document.body;
  const controlSelector = kind === 'filters' ? 'input, select, textarea' : 'button, [role="button"]';
  const controls = Array.from(pageRoot.querySelectorAll<HTMLElement>(controlSelector)).filter((element) => (
    isVisibleElement(element) && !element.closest('[data-tutorial="global-help"]')
  ));
  if (!controls.length) return null;

  const candidates = new Set<HTMLElement>();
  controls.forEach((control) => {
    let parent = control.parentElement;
    for (let depth = 0; parent && depth < 4 && parent !== pageRoot; depth += 1) {
      const visibleControls = Array.from(parent.querySelectorAll<HTMLElement>(controlSelector)).filter(isVisibleElement);
      if (visibleControls.length >= 2 && visibleControls.length <= 12) candidates.add(parent);
      parent = parent.parentElement;
    }
  });
  const ranked = Array.from(candidates).sort((left, right) => {
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();
    return (leftRect.width * leftRect.height) - (rightRect.width * rightRect.height);
  });
  return ranked[0] || controls[0].parentElement || controls[0];
};

const visibleTarget = (target: string | undefined) => {
  if (!target) return null;
  const explicit = firstVisible(`[data-tutorial="${target}"]`);
  if (explicit) return explicit;
  if (target === 'auto-filters') {
    return firstVisible('[data-tutorial="page-filters"]') || findControlCluster('filters');
  }
  if (target === 'auto-actions') {
    return firstVisible('[data-tutorial="page-actions"]') || findControlCluster('actions');
  }
  if (target === 'auto-content') {
    return firstVisible('[data-tutorial="page-main"]')
      || firstVisible('[data-tutorial="page-content"] table, [data-tutorial="page-content"] [role="table"], main table, main [role="table"], main section')
      || firstVisible('[data-tutorial="page-content"]')
      || firstVisible('main');
  }
  return null;
};

const getControlLabel = (element: HTMLElement) => {
  const explicit = element.getAttribute('aria-label') || element.getAttribute('title');
  if (explicit) return explicit.trim();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const label = element.id ? document.querySelector<HTMLLabelElement>(`label[for="${element.id}"]`)?.innerText : '';
    return String(label || element.placeholder || element.name || '').trim();
  }
  if (element instanceof HTMLSelectElement) {
    const label = element.id ? document.querySelector<HTMLLabelElement>(`label[for="${element.id}"]`)?.innerText : '';
    return String(label || element.options[0]?.text || element.name || '').trim();
  }
  return String(element.innerText || '').replace(/\s+/g, ' ').trim();
};

const discoverControlLabels = (target: HTMLElement | null, kind: TutorialStep['discoverControls']) => {
  if (!target || !kind) return [];
  const selector = kind === 'filters' ? 'input, select, textarea' : 'button, [role="button"]';
  return mergeUnique(Array.from(target.querySelectorAll<HTMLElement>(selector))
    .filter(isVisibleElement)
    .map(getControlLabel)
    .filter(Boolean))
    .slice(0, 10);
};

const mergeUnique = (values: string[]) => Array.from(new Set(values));

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const permission = localStorage.getItem('user_permission') || '';
  const token = localStorage.getItem('token');
  const modules = useMemo(() => getTutorialModulesForPermission(permission), [permission]);
  const currentPageModule = useMemo(
    () => findTutorialModuleByPath(location.pathname, permission),
    [location.pathname, permission],
  );
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [active, setActive] = useState<ActiveTour | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [syncWarning, setSyncWarning] = useState(false);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const persistQueueRef = useRef<Promise<TutorialProgress | null>>(Promise.resolve(null));
  const syncRetryTimerRef = useRef<number | null>(null);
  const syncFailureCountRef = useRef(0);
  const syncWarningDismissedRef = useRef(false);
  const progressInitializedRef = useRef(false);

  const module = active ? modules[active.moduleIndex] : null;
  const step = module && active ? module.steps[active.stepIndex] : null;
  const completedModules = useMemo(() => progress?.completed_modules || [], [progress?.completed_modules]);

  const scheduleSyncRetry = useCallback(() => {
    if (syncRetryTimerRef.current !== null) return;
    const delay = Math.min(30_000, Math.max(5_000, syncFailureCountRef.current * 5_000));
    syncRetryTimerRef.current = window.setTimeout(() => {
      syncRetryTimerRef.current = null;
      setSyncAttempt((current) => current + 1);
    }, delay);
  }, []);

  const registerSyncFailure = useCallback((error: unknown) => {
    if (!isRetryableTutorialSyncError(error)) return;
    syncFailureCountRef.current += 1;
    if (syncFailureCountRef.current >= 2 && !syncWarningDismissedRef.current) {
      setSyncWarning(true);
    }
    scheduleSyncRetry();
  }, [scheduleSyncRetry]);

  const registerSyncSuccess = useCallback(() => {
    syncFailureCountRef.current = 0;
    syncWarningDismissedRef.current = false;
    setSyncWarning(false);
    if (syncRetryTimerRef.current !== null) {
      window.clearTimeout(syncRetryTimerRef.current);
      syncRetryTimerRef.current = null;
    }
  }, []);

  const persist = useCallback(async (next: Partial<TutorialProgress>) => {
    setProgress((current) => (current ? { ...current, ...next } : current));
    const request = persistQueueRef.current
      .catch(() => null)
      .then(() => updateTutorialProgress(next));
    persistQueueRef.current = request;
    try {
      const saved = await request;
      setProgress(saved);
      localStorage.removeItem(TUTORIAL_BACKUP_KEY);
      registerSyncSuccess();
    } catch (error) {
      writeTutorialBackup(next);
      registerSyncFailure(error);
    }
  }, [registerSyncFailure, registerSyncSuccess]);

  useEffect(() => {
    if (token) return;
    setActive(null);
    setHelpOpen(false);
    setResumeOpen(false);
    setProgress(null);
    progressInitializedRef.current = false;
    registerSyncSuccess();
  }, [registerSyncSuccess, token]);

  const resumeFromProgress = useCallback(() => {
    if (!modules.length) return;
    const storedIndex = modules.findIndex((item) => item.id === progress?.current_module);
    const moduleIndex = storedIndex >= 0 ? storedIndex : 0;
    const maxStep = Math.max(0, modules[moduleIndex].steps.length - 1);
    const stepIndex = Math.min(Math.max(progress?.current_step || 0, 0), maxStep);
    setResumeOpen(false);
    setHelpOpen(false);
    setActive({ mode: 'full', moduleIndex, stepIndex, persist: true });
  }, [modules, progress]);

  const startFullTutorial = useCallback(() => {
    if (!modules.length) return;
    setResumeOpen(false);
    setHelpOpen(false);
    setActive({
      mode: 'full', moduleIndex: 0, stepIndex: 0,
      persist: !['completed', 'dismissed_by_admin'].includes(progress?.status || ''),
    });
  }, [modules, progress?.status]);

  const startPageGuide = useCallback(() => {
    if (!currentPageModule) return;
    const moduleIndex = modules.findIndex((item) => item.id === currentPageModule.id);
    if (moduleIndex < 0) return;
    setHelpOpen(false);
    setActive({ mode: 'page', moduleIndex, stepIndex: 0, persist: false });
  }, [currentPageModule, modules]);

  useEffect(() => {
    if (!token) return;
    let activeRequest = true;
    const synchronize = async () => {
      try {
        const response = await getCurrentTutorialProgress();
        const backup = readTutorialBackup();
        const saved = backup ? await updateTutorialProgress(backup) : response.progress;
        if (!activeRequest) return;
        if (backup) localStorage.removeItem(TUTORIAL_BACKUP_KEY);
        setProgress(saved);
        registerSyncSuccess();
        if (!progressInitializedRef.current) {
          progressInitializedRef.current = true;
          if (saved.status === 'not_started') {
            if (modules.length) setActive({ mode: 'full', moduleIndex: 0, stepIndex: 0, persist: true });
          } else if (saved.status === 'in_progress') {
            setResumeOpen(true);
          }
        }
      } catch (error) {
        if (activeRequest) registerSyncFailure(error);
      }
    };
    const retryNow = () => {
      if (syncRetryTimerRef.current !== null) {
        window.clearTimeout(syncRetryTimerRef.current);
        syncRetryTimerRef.current = null;
      }
      setSyncAttempt((current) => current + 1);
    };
    void synchronize();
    window.addEventListener('online', retryNow);
    return () => {
      activeRequest = false;
      window.removeEventListener('online', retryNow);
    };
  }, [modules.length, registerSyncFailure, registerSyncSuccess, syncAttempt, token]);

  useEffect(() => {
    if (!module || !step) {
      setTargetElement(null);
      return undefined;
    }
    if (!token) return undefined;
    const isCurrentModuleRoute = location.pathname === module.route
      || (module.id === 'invoice-journey' && /^\/invoices\/[^/]+\/journey$/.test(location.pathname));
    if (!isCurrentModuleRoute) {
      navigate(module.route);
      return undefined;
    }

    const targetName = window.innerWidth < 768 && step.targetMobile ? step.targetMobile : step.target;
    if (!targetName || step.placement === 'center') {
      setTargetElement(null);
      setTargetMissing(false);
      return undefined;
    }

    let stopped = false;
    let timeout: number;
    const find = () => {
      if (stopped) return false;
      const found = visibleTarget(targetName);
      if (!found) return false;
      setTargetElement(found);
      setTargetMissing(false);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      found.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      return true;
    };
    if (find()) return undefined;

    setTargetElement(null);
    const observer = new MutationObserver(() => {
      if (find()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    timeout = window.setTimeout(() => {
      observer.disconnect();
      if (!stopped && !find()) setTargetMissing(true);
    }, targetName.startsWith('auto-') ? 1500 : 7000);
    return () => {
      stopped = true;
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [location.pathname, module, navigate, step, token]);

  useEffect(() => {
    if (!active || active.mode !== 'full' || active.persist === false || !module) return;
    void persist({
      status: 'in_progress',
      current_module: module.id,
      current_step: active.stepIndex,
      completed_modules: completedModules,
    });
  // Persist only when the active step changes; progress updates must not retrigger the request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.mode, active?.moduleIndex, active?.stepIndex, module?.id, persist]);

  const closeTour = useCallback(() => {
    setActive(null);
    setTargetElement(null);
    setTargetMissing(false);
  }, []);

  const pause = useCallback(async () => {
    if (active?.mode === 'full' && active.persist !== false && module) {
      try {
        await persistQueueRef.current.catch(() => null);
        const saved = await pauseTutorialProgress({ current_module: module.id, current_step: active.stepIndex });
        setProgress(saved);
        localStorage.removeItem(TUTORIAL_BACKUP_KEY);
        registerSyncSuccess();
      } catch (error) {
        registerSyncFailure(error);
      }
    }
    closeTour();
  }, [active, closeTour, module, registerSyncFailure, registerSyncSuccess]);

  const finish = useCallback(async (done: string[]) => {
    closeTour();
    try {
      await persistQueueRef.current.catch(() => null);
      const saved = await completeTutorialProgress(done);
      setProgress(saved);
      localStorage.removeItem(TUTORIAL_BACKUP_KEY);
      registerSyncSuccess();
    } catch (error) {
      registerSyncFailure(error);
    }
  }, [closeTour, registerSyncFailure, registerSyncSuccess]);

  const next = useCallback(() => {
    if (!active || !module) return;
    if (active.stepIndex < module.steps.length - 1) {
      setActive({ ...active, stepIndex: active.stepIndex + 1 });
      return;
    }
    if (active.mode === 'page') {
      closeTour();
      setHelpOpen(true);
      return;
    }
    const done = mergeUnique([...completedModules, module.id]);
    if (active.moduleIndex < modules.length - 1) {
      setProgress((current) => (current ? { ...current, completed_modules: done } : current));
      setActive({ mode: 'full', moduleIndex: active.moduleIndex + 1, stepIndex: 0, persist: active.persist });
      return;
    }
    if (active.persist === false) closeTour();
    else void finish(done);
  }, [active, closeTour, completedModules, finish, module, modules.length]);

  const previous = useCallback(() => {
    if (!active) return;
    if (active.stepIndex > 0) {
      setActive({ ...active, stepIndex: active.stepIndex - 1 });
    } else if (active.mode === 'full' && active.moduleIndex > 0) {
      const previousModule = modules[active.moduleIndex - 1];
      setActive({ mode: 'full', moduleIndex: active.moduleIndex - 1, stepIndex: previousModule.steps.length - 1, persist: active.persist });
    }
  }, [active, modules]);

  useEffect(() => {
    if (!active && !helpOpen && !resumeOpen) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (active) void pause();
        else { setHelpOpen(false); setResumeOpen(false); }
      }
      if (active && event.key === 'ArrowRight') next();
      if (active && event.key === 'ArrowLeft') previous();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active, helpOpen, next, pause, previous, resumeOpen]);

  const value = useMemo<TutorialContextValue>(() => ({
    openPageHelp: () => setHelpOpen(true), startPageGuide, startFullTutorial, progress,
  }), [progress, startFullTutorial, startPageGuide]);

  const overallStep = active
    ? modules.slice(0, active.moduleIndex).reduce((sum, item) => sum + item.steps.length, 0) + active.stepIndex + 1
    : 0;
  const totalSteps = modules.reduce((sum, item) => sum + item.steps.length, 0);

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {token && location.pathname.startsWith('/control-tower') && (
        <button
          type="button"
          data-tutorial="global-help"
          onClick={() => setHelpOpen(true)}
          className="fixed bottom-5 right-5 z-[1200] inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-xl focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          aria-label="Abrir ajuda desta página"
          title="Ajuda desta página"
        >
          <CircleHelp className="h-6 w-6" />
        </button>
      )}
      {syncWarning && token && location.pathname !== '/' && (
        <div className="fixed bottom-4 left-4 z-[2400] flex max-w-sm items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-lg" role="status">
          <AlertCircle className="h-4 w-4 shrink-0" />
          O sistema continua disponível. Estamos tentando sincronizar o progresso do tutorial em segundo plano.
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => {
              syncWarningDismissedRef.current = true;
              setSyncWarning(false);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {active && module && step && (
        <TourOverlay
          active={active}
          module={module}
          step={step}
          target={targetElement}
          targetMissing={targetMissing}
          overallStep={active.mode === 'full' ? overallStep : active.stepIndex + 1}
          totalSteps={active.mode === 'full' ? totalSteps : module.steps.length}
          canGoBack={active.stepIndex > 0 || (active.mode === 'full' && active.moduleIndex > 0)}
          onBack={previous}
          onNext={next}
          onPause={() => void pause()}
        />
      )}
      {helpOpen && (
        <HelpDialog
          module={currentPageModule}
          modules={modules}
          progress={progress}
          onClose={() => setHelpOpen(false)}
          onStartPage={startPageGuide}
          onStartFull={startFullTutorial}
        />
      )}
      {resumeOpen && (
        <ResumeDialog
          onResume={resumeFromProgress}
          onRestart={startFullTutorial}
          onLater={() => setResumeOpen(false)}
        />
      )}
    </TutorialContext.Provider>
  );
}

function TourOverlay({
  active, module, step, target, targetMissing, overallStep, totalSteps, canGoBack, onBack, onNext, onPause,
}: {
  active: ActiveTour; module: TutorialModule; step: TutorialStep; target: HTMLElement | null;
  targetMissing: boolean; overallStep: number; totalSteps: number; canGoBack: boolean;
  onBack: () => void; onNext: () => void; onPause: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(target?.getBoundingClientRect() || null);
  useEffect(() => {
    if (!target) { setRect(null); return undefined; }
    let animationFrameId = 0;
    const update = () => {
      const nextRect = target.getBoundingClientRect();
      setRect((currentRect) => {
        if (
          currentRect
          && Math.abs(currentRect.left - nextRect.left) < 0.5
          && Math.abs(currentRect.top - nextRect.top) < 0.5
          && Math.abs(currentRect.width - nextRect.width) < 0.5
          && Math.abs(currentRect.height - nextRect.height) < 0.5
        ) return currentRect;
        return nextRect;
      });
      animationFrameId = window.requestAnimationFrame(update);
    };
    update();
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [target]);

  const last = active.stepIndex === module.steps.length - 1;
  const discoveredControls = useMemo(
    () => discoverControlLabels(target, step.discoverControls),
    [step.discoverControls, target],
  );
  return (
    <div className="fixed inset-0 z-[2500]" role="dialog" aria-modal="true" aria-label={`Tutorial: ${step.title}`}>
      {!rect && <div className="absolute inset-0 bg-slate-950/65" />}
      {rect && (
        <div
          className="pointer-events-none fixed rounded-xl ring-4 ring-cyan-400 transition-all motion-reduce:transition-none"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12, zIndex: 2501, boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.68)' }}
          aria-hidden="true"
        />
      )}
      <section className="fixed inset-x-3 bottom-3 z-[2502] mx-auto max-w-lg rounded-2xl border border-border bg-card p-5 text-text shadow-2xl md:bottom-6" tabIndex={-1}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-text-accent">{module.title}</p>
            <h2 className="mt-1 text-lg font-bold text-text">{step.title}</h2>
          </div>
          <button type="button" onClick={onPause} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Pausar tutorial"><Pause className="h-5 w-5" /></button>
        </div>
        <p className="text-sm leading-6 text-muted">{step.content}</p>
        {!!discoveredControls.length && (
          <div className="mt-3 rounded-lg border border-border bg-surface p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-accent">Controles disponíveis</p>
            <div className="flex flex-wrap gap-1.5">
              {discoveredControls.map((label) => <span key={label} className="rounded-full border border-border bg-surface-2 px-2 py-1 text-xs font-medium text-text">{label}</span>)}
            </div>
          </div>
        )}
        {targetMissing && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Este elemento não está disponível agora. Você pode continuar sem executar nenhuma ação.</p>}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label={`${overallStep} de ${totalSteps}`}>
          <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(4, (overallStep / Math.max(totalSteps, 1)) * 100)}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">Passo {overallStep} de {totalSteps}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onBack} disabled={!canGoBack} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-surface-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Voltar</button>
            <button type="button" autoFocus onClick={onNext} className="inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong">
              {targetMissing && step.required === false ? 'Pular' : last && active.mode === 'page' ? 'Concluir' : 'Próximo'}<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function HelpDialog({ module, modules, progress, onClose, onStartPage, onStartFull }: {
  module: TutorialModule | null; modules: TutorialModule[]; progress: TutorialProgress | null;
  onClose: () => void; onStartPage: () => void; onStartFull: () => void;
}) {
  const completed = new Set(progress?.completed_modules || []);
  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-labelledby="tutorial-help-title">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 text-text shadow-2xl md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wider text-text-accent">Ajuda contextual</p><h2 id="tutorial-help-title" className="mt-1 text-xl font-bold text-text">{module?.title || 'Ajuda do sistema'}</h2></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text hover:bg-surface-2" aria-label="Fechar ajuda"><X className="h-5 w-5" /></button>
        </div>
        {module ? (
          <>
            <p className="mt-3 text-sm text-muted">{module.description}</p>
            <h3 className="mt-5 font-bold text-text">O que você faz aqui</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted">{module.summary.map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{item}</li>)}</ul>
            {!!module.importantRules?.length && <><h3 className="mt-5 font-bold text-text">Regras importantes</h3><ul className="mt-2 space-y-2 text-sm text-muted">{module.importantRules.map((item) => <li key={item}>• {item}</li>)}</ul></>}
            {!!module.faq?.length && <><h3 className="mt-5 font-bold text-text">Dúvidas frequentes</h3><div className="mt-2 space-y-2">{module.faq.map((item) => <details key={item.question} className="rounded-xl border border-border bg-surface p-3 text-text"><summary className="cursor-pointer text-sm font-semibold">{item.question}</summary><p className="mt-2 text-sm text-muted">{item.answer}</p></details>)}</div></>}
          </>
        ) : <p className="mt-3 text-sm text-muted">Esta página ainda não possui um guia específico. Você pode abrir o tutorial completo para conhecer os módulos disponíveis ao seu perfil.</p>}
        <h3 className="mt-6 font-bold text-text">Seu progresso</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">{modules.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text"><Check className={`h-4 w-4 ${completed.has(item.id) ? 'text-emerald-500' : 'text-muted'}`} />{item.title}</div>)}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onStartFull} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-surface-2"><RotateCcw className="h-4 w-4" />Rever tutorial completo</button>
          {module && <button type="button" onClick={onStartPage} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"><Play className="h-4 w-4" />Iniciar guia desta página</button>}
        </div>
      </section>
    </div>
  );
}

function ResumeDialog({ onResume, onRestart, onLater }: { onResume: () => void; onRestart: () => void; onLater: () => void }) {
  return (
    <div className="fixed inset-0 z-[2500] grid place-items-center bg-slate-950/60 p-3" role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-text shadow-2xl">
        <BookOpen className="h-9 w-9 text-text-accent" />
        <h2 id="resume-title" className="mt-3 text-xl font-bold text-text">Continuar de onde parou?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Seu progresso foi salvo. Você pode continuar, rever desde o início ou deixar para mais tarde.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onResume} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"><Play className="h-4 w-4" />Continuar</button>
          <button type="button" onClick={onRestart} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-2"><RotateCcw className="h-4 w-4" />Reiniciar</button>
          <button type="button" onClick={onLater} className="rounded-lg px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text sm:col-span-2">Continuar mais tarde</button>
        </div>
      </section>
    </div>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) throw new Error('useTutorial deve ser usado dentro de TutorialProvider');
  return context;
}
