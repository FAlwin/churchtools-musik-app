import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Kleiner, selbst verschwindender Hinweis (z. B. „Offline nicht verfügbar"). Liefert den aktuellen
 * Text + `showToast`; die Darstellung übernimmt die `<Toast>`-Komponente (`components/Toast.tsx`).
 */
export function useToast(): { toast: string | null; showToast: (msg: string) => void } {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return { toast, showToast };
}
