// ABOUTME: Renders the toast stack from toast-store in the bottom-right corner.
// ABOUTME: Mounted once in AppLayout; toasts auto-dismiss or close on click.

import { X } from 'lucide-react';
import { useToastStore } from '@/lib/stores/toast-store';

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-2 border bg-poe-bg px-3 py-2 text-sm shadow-2xl ${
            t.kind === 'error' ? 'border-poe-error/50 text-poe-error' : 'border-poe-success/40 text-poe-success'
          }`}
        >
          <p className="min-w-0 flex-1 break-words">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-poe-text-muted hover:text-poe-text"
            aria-label="Dismiss notification"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
