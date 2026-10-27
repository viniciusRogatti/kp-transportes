/** Poll only a visible tab; never overlap scheduled requests. Resume immediately. */
export function startVisiblePolling(refresh: () => Promise<void>, intervalMs: number) {
  let stopped = false;
  let running = false;
  const run = async () => {
    if (stopped || running || document.visibilityState === 'hidden') return;
    running = true;
    try { await refresh(); } finally { running = false; }
  };
  const onVisible = () => { void run(); };
  const timer = window.setInterval(onVisible, intervalMs);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
