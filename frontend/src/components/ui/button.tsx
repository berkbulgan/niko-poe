// ABOUTME: Reusable Button component with PoE-themed variants using class-variance-authority.
// ABOUTME: Supports primary (gold gradient), secondary, danger, and ghost variants with size options.

'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-poe-gold/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-b from-poe-gold to-amber-800 text-white shadow-md hover:from-amber-600 hover:to-amber-900',
        secondary:
          'border border-poe-border bg-poe-panel text-poe-text hover:bg-poe-panel-light',
        danger:
          'bg-poe-error/90 text-white hover:bg-poe-error',
        ghost:
          'text-poe-text-dim hover:bg-poe-panel-light hover:text-poe-text',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export { buttonVariants };
