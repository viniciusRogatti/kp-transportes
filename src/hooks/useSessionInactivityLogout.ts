import { useEffect, useRef } from 'react';
import { logoutSession } from '../utils/logoutSession';

const INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'click',
  'keydown',
  'mousemove',
  'scroll',
  'touchstart',
];

export default function useSessionInactivityLogout() {
  const timeoutRef = useRef<number | null>(null);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const clearExistingTimeout = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const performLogout = async () => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      clearExistingTimeout();

      try {
        await logoutSession();
      } finally {
        window.alert('Sua sessão foi encerrada por inatividade. Faça login novamente.');
        window.location.hash = '#/';
      }
    };

    const scheduleTimeout = () => {
      clearExistingTimeout();

      const token = localStorage.getItem('token');
      if (!token) return;

      timeoutRef.current = window.setTimeout(() => {
        void performLogout();
      }, INACTIVITY_LIMIT_MS);
    };

    const handleActivity = () => {
      if (loggingOutRef.current) return;
      scheduleTimeout();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };

    scheduleTimeout();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearExistingTimeout();
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}
