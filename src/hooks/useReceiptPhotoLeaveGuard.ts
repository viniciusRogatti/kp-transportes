import { useContext, useEffect, useRef } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';
import { showConfirm } from '../utils/dialog';

/** Keep a deliberate exit possible while protecting the physical-photo handoff. */
export default function useReceiptPhotoLeaveGuard(count: number) {
  const navigation = useContext(UNSAFE_NavigationContext);
  const pending = useRef(count);
  pending.current = count;
  useEffect(() => {
    let leaving = false;
    let asking = false;
    let currentUrl = window.location.href;
    let currentState = window.history.state;
    let restoring = false;
    const message = () => `Ainda há ${pending.current} canhoto(s) presente(s) sem foto ou com confirmação a verificar. Publique as fotos antes de encaminhar os documentos. Deseja sair mesmo assim?`;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!pending.current || leaving) return;
      event.preventDefault(); event.returnValue = '';
    };
    const onClick = async (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!pending.current || leaving || !anchor || anchor.target === '_blank'
        || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
        || anchor.href === window.location.href || anchor.hasAttribute('download')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (asking) return;
      asking = true;
      const accepted = await showConfirm(message(), { title: 'Fotos pendentes antes de sair',
        confirmLabel: 'Sair mantendo o alerta', cancelLabel: 'Continuar conferindo', tone: 'danger' });
      asking = false;
      if (accepted) { leaving = true; window.location.assign(anchor.href); }
    };
    const onPopState = () => {
      if (restoring) return;
      if (pending.current && !leaving && window.location.href !== currentUrl && !window.confirm(message())) {
        restoring = true;
        window.history.replaceState(currentState, '', currentUrl);
        window.dispatchEvent(new PopStateEvent('popstate', { state: currentState }));
        restoring = false;
        return;
      }
      currentUrl = window.location.href;
      currentState = window.history.state;
    };
    let restoreNavigator = () => {};
    // HashRouter does not expose the data-router blocker API. Cover useNavigate
    // as well as links, without replacing the application's router.
    if (navigation?.navigator) {
      const navigator = navigation.navigator;
      const push = navigator.push;
      const replace = navigator.replace;
      const authorize = (action: () => void) => {
        if (!pending.current || leaving || !localStorage.getItem('token')) { action(); return; }
        if (asking) return;
        asking = true;
        void showConfirm(message(), { title: 'Fotos pendentes antes de sair', confirmLabel: 'Sair mantendo o alerta',
          cancelLabel: 'Continuar conferindo', tone: 'danger' }).then(accepted => {
          asking = false;
          if (accepted) { leaving = true; action(); }
        });
      };
      const isLogin = (to: Parameters<typeof push>[0]) => to === '/' || (typeof to === 'object' && to.pathname === '/');
      const guardedPush: typeof push = (...args) => isLogin(args[0]) ? push.apply(navigator, args) : authorize(() => push.apply(navigator, args));
      const guardedReplace: typeof replace = (...args) => isLogin(args[0]) ? replace.apply(navigator, args) : authorize(() => replace.apply(navigator, args));
      navigator.push = guardedPush;
      navigator.replace = guardedReplace;
      restoreNavigator = () => {
        if (navigator.push === guardedPush) navigator.push = push;
        if (navigator.replace === guardedReplace) navigator.replace = replace;
      };
    }
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick, true);
      restoreNavigator();
    };
  }, [navigation]);
}
