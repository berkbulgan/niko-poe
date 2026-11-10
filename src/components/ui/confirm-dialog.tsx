// ABOUTME: Renders the pending confirmation from the confirm store as one AlertDialog.
// ABOUTME: Mount once (AppLayout); confirmAction/confirmDiscard in platform.ts open it.

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
  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent {...(request?.description ? {} : { 'aria-describedby': undefined })}>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={request?.destructive ? buttonVariants({ variant: 'danger', size: 'sm' }) : undefined}
            onClick={() => settle(true)}
          >
            {request?.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
