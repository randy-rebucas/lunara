'use client';

interface PhonePreviewMockupProps {
  logoUrl?: string;
  businessName: string;
}

/** Static phone-frame mockup of the customer-app home screen with the partner's uploaded logo
 * and business name overlaid on Lunara's default colors — logo-only branding preview (no color
 * customization in this flow). */
export function PhonePreviewMockup({ logoUrl, businessName }: PhonePreviewMockupProps) {
  return (
    <div className="mx-auto w-[220px]">
      <div className="rounded-[2rem] border-[6px] border-slate-900 bg-slate-900 shadow-xl">
        <div className="relative h-[420px] w-full overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-primary to-primary/80">
          <div className="absolute left-1/2 top-0 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-slate-900" aria-hidden />

          <div className="flex h-full flex-col items-center px-4 pb-5 pt-9 text-white">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary">
                  {businessName.trim().charAt(0).toUpperCase() || 'L'}
                </span>
              )}
            </div>
            <p className="mt-3 text-center text-sm font-bold leading-tight">
              {businessName.trim() || 'Your Shop'}
            </p>
            <p className="text-[10px] text-white/80">Powered by Lunara</p>

            <div className="mt-6 w-full rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-[11px] font-semibold">Book a pickup</p>
              <p className="mt-1 text-[10px] text-white/80">Wash, dry &amp; fold — delivered</p>
            </div>

            <div className="mt-3 grid w-full grid-cols-2 gap-2">
              <div className="rounded-lg bg-white/10 p-2 text-center text-[10px]">Track Order</div>
              <div className="rounded-lg bg-white/10 p-2 text-center text-[10px]">Rewards</div>
            </div>

            <div className="mt-auto flex w-full items-center justify-around rounded-xl bg-black/20 px-2 py-2 text-[9px]">
              <span>Home</span>
              <span>Orders</span>
              <span>Rewards</span>
              <span>Profile</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Preview of your branded customer app
      </p>
    </div>
  );
}
