// ABOUTME: Small Badge/Tag component for displaying filter categories with PoE-themed colors.
// ABOUTME: Maps category types (stat, modifier, attribute, custom) to distinct color schemes.

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-default',
  {
    variants: {
      variant: {
        stat: 'bg-poe-magic/15 text-poe-magic border border-poe-magic/30',
        modifier: 'bg-purple-500/15 text-purple-400 border border-purple-400/30',
        attribute: 'bg-poe-success/15 text-poe-success border border-poe-success/30',
        custom: 'bg-poe-gold/15 text-poe-gold border border-poe-gold/30',
        default: 'bg-poe-panel-light text-poe-text-dim border border-poe-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
