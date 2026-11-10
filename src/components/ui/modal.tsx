// ABOUTME: Modal wrapper over the shadcn Dialog, keeping the app's isOpen/onClose/title API.
// ABOUTME: Escape, overlay click and the corner X all call onClose; focus is trapped while open.

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Modal({ isOpen, onClose, children, className, title }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={className} aria-describedby={undefined}>
        <DialogTitle className={title ? undefined : 'sr-only'}>{title ?? 'Dialog'}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
