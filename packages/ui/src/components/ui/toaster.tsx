'use client';

import { useToast } from './use-toast';
import { Toast, ToastTitle, ToastDescription } from './toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant} onClose={() => dismiss(t.id)}>
          <div className="grid gap-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
        </Toast>
      ))}
    </div>
  );
}
