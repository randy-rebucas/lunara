import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium leading-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white shadow-sm hover:bg-primary/90 active:bg-primary/95',
        secondary: 'bg-secondary text-white shadow-sm hover:bg-secondary/90 active:bg-secondary/95',
        outline:
          'bg-surface text-slate-700 shadow-sm ring-1 ring-border/70 hover:bg-slate-50 hover:ring-border active:bg-slate-100',
        ghost: 'text-slate-700 hover:bg-slate-100 active:bg-slate-200/80',
      },
      size: {
        default: 'min-h-10 px-5 py-2.5 text-sm sm:min-h-11 sm:px-6',
        sm: 'min-h-9 rounded-md px-4 py-2 text-xs sm:px-5 sm:text-sm',
        lg: 'min-h-11 px-6 py-3 text-sm sm:min-h-12 sm:px-8 sm:text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
