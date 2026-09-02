export interface ExtractedLogoColors {
  primary: string;
  secondary: string;
  accent: string;
}

function toHex(n: number) {
  return n.toString(16).padStart(2, '0');
}

/** Samples the uploaded logo on an offscreen canvas and buckets pixels by hue to pick three
 *  visually distinct, sufficiently saturated colors. Runs entirely in-browser — no server round
 *  trip needed just to preview a palette. */
export function extractLogoColors(file: File): Promise<ExtractedLogoColors> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lightness = (max + min) / 2;
          const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255));
          // Skip near-white/near-black/low-saturation pixels — backgrounds, not brand color.
          if (lightness > 240 || lightness < 15 || saturation < 0.15) continue;

          const hueBucket = Math.round((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI / 15) * 15;
          const key = ((hueBucket % 360) + 360) % 360;
          const existing = buckets.get(key);
          if (existing) {
            existing.count += 1;
            existing.r += r;
            existing.g += g;
            existing.b += b;
          } else {
            buckets.set(key, { count: 1, r, g, b });
          }
        }

        const ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
        const fallback = { primary: '#4F46E5', secondary: '#06B6D4', accent: '#22C55E' };
        if (ranked.length === 0) {
          resolve(fallback);
          return;
        }

        const toColor = (bucket: { count: number; r: number; g: number; b: number }) =>
          `#${toHex(Math.round(bucket.r / bucket.count))}${toHex(Math.round(bucket.g / bucket.count))}${toHex(Math.round(bucket.b / bucket.count))}`;

        resolve({
          primary: toColor(ranked[0]),
          secondary: ranked[1] ? toColor(ranked[1]) : fallback.secondary,
          accent: ranked[2] ? toColor(ranked[2]) : fallback.accent,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to extract colors'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}
