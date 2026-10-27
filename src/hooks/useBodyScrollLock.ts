import { useEffect } from 'react';

// A page and its dialogs can release their locks in any order (including navigation).
// Restore the original style only after the last owner has left.
const owners = new Set<symbol>();
let previousOverflow = '';

export default function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const owner = Symbol('body-scroll-lock');
    if (owners.size === 0) previousOverflow = document.body.style.overflow;
    owners.add(owner);
    document.body.style.overflow = 'hidden';
    return () => {
      owners.delete(owner);
      if (owners.size === 0) document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}
