import Image from 'next/image';

export function AuthLoading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="laundry-bg flex min-h-screen flex-col items-center justify-center gap-3">
      <Image src="/images/washing-machine-preloader.svg" alt="" width={64} height={64} className="h-16 w-16" />
      <div className="text-sm text-muted">{message}</div>
    </div>
  );
}
