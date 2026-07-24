'use client';

import { useCallback } from 'react';
import { useAuthContext } from '@lunara/hooks/auth-provider';
import { useCustomerQuery } from '../../lib/use-customer-query';

interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
}

export function BannerStrip() {
  const { api, isAuthenticated } = useAuthContext();

  const load = useCallback(async () => {
    if (!isAuthenticated) return [] as Banner[];
    const res = await api.get<Banner[]>('/banners');
    return res.data;
  }, [api, isAuthenticated]);

  const { data: banners } = useCustomerQuery(load, [api, isAuthenticated]);

  if (!banners?.length) return null;

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {banners.map((banner) =>
        banner.linkUrl ? (
          <a
            key={banner._id}
            href={banner.linkUrl}
            className="block w-[min(100%,320px)] shrink-0 snap-start overflow-hidden rounded-xl ring-1 ring-border/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt={banner.title} className="h-32 w-full object-cover" />
          </a>
        ) : (
          <div
            key={banner._id}
            className="w-[min(100%,320px)] shrink-0 snap-start overflow-hidden rounded-xl ring-1 ring-border/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt={banner.title} className="h-32 w-full object-cover" />
          </div>
        ),
      )}
    </div>
  );
}
