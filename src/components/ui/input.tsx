// ABOUTME: Styled dark Input component with PoE border and gold focus ring.
// ABOUTME: Forwards ref and supports all native input attributes.

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-poe-border bg-poe-panel px-3 py-2 text-sm text-poe-text placeholder:text-poe-text-muted transition-default',
          'focus:border-poe-gold/50 focus:outline-none focus:ring-1 focus:ring-poe-gold/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
