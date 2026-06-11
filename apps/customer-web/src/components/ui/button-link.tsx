import Link from 'next/link';
import { buttonVariants, cn, type ButtonProps } from '@lunara/ui';
import { buttonLayoutClass, type ButtonLinkLayout } from './button-layout';

export type { ButtonLinkLayout } from './button-layout';
export { buttonResponsiveClass, buttonLayoutClass } from './button-layout';

type ButtonLinkProps = Omit<React.ComponentProps<typeof Link>, 'className'> &
  Pick<ButtonProps, 'variant' | 'size'> & {
    className?: string;
    layout?: ButtonLinkLayout;
  };

export function ButtonLink({
  className,
  variant,
  size,
  layout,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size }), buttonLayoutClass(layout, size), className)}
      {...props}
    />
  );
}

type ButtonAnchorProps = React.ComponentProps<'a'> &
  Pick<ButtonProps, 'variant' | 'size'> & {
    layout?: ButtonLinkLayout;
  };

/** For mailto:, tel:, and other non-route hrefs — avoids Next.js Link prefetch issues. */
export function ButtonAnchor({
  className,
  variant,
  size,
  layout,
  ...props
}: ButtonAnchorProps) {
  return (
    <a
      className={cn(buttonVariants({ variant, size }), buttonLayoutClass(layout, size), className)}
      {...props}
    />
  );
}
