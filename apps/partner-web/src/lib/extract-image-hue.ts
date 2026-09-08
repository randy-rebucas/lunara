/** Samples an image's pixels on a canvas and returns the average hue (0-360)
 * of its most saturated pixels, so a UI accent color can be derived from a
 * partner's uploaded logo without asking them to also pick a color. */
export function extractDominantHue(imageUrl: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let sumX = 0;
        let sumY = 0;
        let weightTotal = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          const a = data[i + 3] / 255;
          if (a < 0.3) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.15 || max < 0.1 || max > 0.98) continue;

          let hue = 0;
          const d = max - min;
          if (d !== 0) {
            if (max === r) hue = ((g - b) / d) % 6;
            else if (max === g) hue = (b - r) / d + 2;
            else hue = (r - g) / d + 4;
          }
          hue *= 60;
          if (hue < 0) hue += 360;

          const weight = sat * a;
          sumX += Math.cos((hue * Math.PI) / 180) * weight;
          sumY += Math.sin((hue * Math.PI) / 180) * weight;
          weightTotal += weight;
        }

        if (weightTotal < 1) return resolve(null);
        let avgHue = (Math.atan2(sumY, sumX) * 180) / Math.PI;
        if (avgHue < 0) avgHue += 360;
        resolve(avgHue);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
