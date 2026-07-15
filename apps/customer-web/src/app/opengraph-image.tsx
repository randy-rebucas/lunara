import { ImageResponse } from 'next/og';
import { appConfig } from '@lunara/config';

export const alt = `${appConfig.name} — Laundry pickup & delivery in Metro Manila`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Soap bubbles */}
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 96,
            width: 180,
            height: 180,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.12)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 190,
            right: 320,
            width: 72,
            height: 72,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.10)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            right: -40,
            width: 280,
            height: 280,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.08)',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 36,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#ffffff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            {appConfig.name.charAt(0)}
          </div>
          {appConfig.name}
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-2px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span>Laundry day,</span>
          <span>simplified.</span>
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 32,
            color: 'rgba(255,255,255,0.85)',
            maxWidth: 760,
          }}
        >
          Pickup, professional cleaning, and delivery — booked in seconds.
        </div>
      </div>
    ),
    size,
  );
}
