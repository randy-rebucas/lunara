import type { ButtonProps } from '@lunara/ui';

export type ButtonLinkLayout = 'inline' | 'responsive' | 'block';

type ButtonSize = NonNullable<ButtonProps['size']>;

const responsiveLayoutBySize: Record<ButtonSize, string> = {
  sm: 'w-full justify-center sm:w-auto sm:min-w-[7.5rem]',
  default: 'w-full justify-center sm:w-auto sm:min-w-[11rem]',
  lg: 'w-full justify-center sm:w-auto sm:min-w-[12rem]',
};

const blockLayoutBySize: Record<ButtonSize, string> = {
  sm: 'w-full justify-center',
  default: 'w-full justify-center',
  lg: 'w-full justify-center',
};

function resolveSize(size: ButtonProps['size']): ButtonSize {
  if (size === 'sm' || size === 'lg') return size;
  return 'default';
}

export function buttonResponsiveClass(size: ButtonProps['size'] = 'default') {
  return responsiveLayoutBySize[resolveSize(size)];
}

export function buttonLayoutClass(layout: ButtonLinkLayout | undefined, size: ButtonProps['size']) {
  const resolvedSize = resolveSize(size);
  if (layout === 'responsive') return responsiveLayoutBySize[resolvedSize];
  if (layout === 'block') return blockLayoutBySize[resolvedSize];
  return 'justify-center';
}
