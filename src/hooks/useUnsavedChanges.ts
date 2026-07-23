import { useEffect, useState } from 'react';

export function useUnsavedChanges(active: boolean, onDiscard: () => void) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [active]);

  const requestClose = () => {
    if (active) setConfirmOpen(true);
    else onDiscard();
  };

  const discard = () => {
    setConfirmOpen(false);
    onDiscard();
  };

  return {
    confirmOpen,
    requestClose,
    cancelDiscard: () => setConfirmOpen(false),
    discard
  };
}
