'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
}

const PAGE_SIZE = 3;

function BannerTile({ banner }: { banner: Banner }) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={banner.imageUrl} alt={banner.title} className="h-auto w-full object-contain" />
  );

  const className = 'w-full overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border/50';

  return banner.linkUrl ? (
    <a href={banner.linkUrl} className={className}>
      {image}
    </a>
  ) : (
    <div className={className}>{image}</div>
  );
}

export function BannerStrip() {
  const { api, isAuthenticated } = useAuthContext();
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!isAuthenticated) return [] as Banner[];
    const res = await api.get<Banner[]>('/banners');
    return res.data;
  }, [api, isAuthenticated]);

  const { data: banners } = useCustomerQuery(load, [api, isAuthenticated]);

  const pageCount = banners ? Math.ceil(banners.length / PAGE_SIZE) : 0;
  const currentPage = Math.min(page, Math.max(pageCount - 1, 0));
  const visibleBanners = useMemo(
    () => banners?.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE) ?? [],
    [banners, currentPage],
  );

  if (!banners?.length) return null;

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {visibleBanners.map((banner) => (
          <BannerTile key={banner._id} banner={banner} />
        ))}
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            aria-label="Previous banners"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-slate-700 shadow-sm ring-1 ring-border/60 transition hover:text-primary disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>

          <div className="flex items-center gap-1.5" role="tablist" aria-label="Banner page">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentPage}
                aria-label={`Go to banner page ${i + 1}`}
                onClick={() => setPage(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentPage ? 'w-5 bg-primary' : 'w-1.5 bg-border hover:bg-slate-300'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage >= pageCount - 1}
            aria-label="Next banners"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-slate-700 shadow-sm ring-1 ring-border/60 transition hover:text-primary disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
