import { forwardRef } from 'react';
import { cn } from '@lunara/ui';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn('input-field', className)} {...props} />;
  },
);

export function FormLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('form-label', className)} {...props} />;
}
