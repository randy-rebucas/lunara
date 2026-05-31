import Link from 'next/link';
import { buttonVariants, cn, type ButtonProps } from '@lunara/ui';

type ButtonLinkProps = Omit<React.ComponentProps<typeof Link>, 'className'> &
  Pick<ButtonProps, 'variant' | 'size'> & {
    className?: string;
  };

export function ButtonLink({ className, variant, size, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
