// ABOUTME: Renders the pending confirmation from the confirm store as one AlertDialog.
// ABOUTME: Mount once (AppLayout); confirmAction/confirmDiscard in platform.ts open it.

import { useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { settle, useConfirmStore } from '@/lib/stores/confirm-store';

export function ConfirmProvider() {
  const request = useConfirmStore((s) => s.request);
  // Keep the last request so the content does not blank out during the exit animation.
  const last = useRef(request);
  if (request) last.current = request;
  const shown = last.current;
  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent {...(shown?.description ? {} : { 'aria-describedby': undefined })}>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown?.title}</AlertDialogTitle>
          {shown?.description && <AlertDialogDescription>{shown.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={shown?.destructive ? buttonVariants({ variant: 'danger', size: 'sm' }) : undefined}
            onClick={() => settle(true)}
          >
            {shown?.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
