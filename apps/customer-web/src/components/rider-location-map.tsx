'use client';

export function RiderLocationMap({ lat, lng }: { lat: number; lng: number }) {
  const delta = 0.012;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border/50">
      <iframe
        title="Rider location map"
        src={embedUrl}
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3 text-sm">
        <span className="text-muted">
          Live rider location · {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-medium text-primary hover:text-primary/80"
        >
          Open in Maps →
        </a>
      </div>
    </div>
  );
}
