// CRT TV. Layers, back-to-front:
//   1. <canvas> static snow (always rendered; opacity ramps with `snowLevel`)
//   2. channel <img> (only when locked)
//   3. scanlines + vignette + glass curve (CSS pseudo-elements)
//   4. chyron overlays — frequency + station name + subtitle
//
// The whole TV is the drag surface — pointerdown is captured here.

import { useEffect, useRef } from 'react';
import './TV.less';

export type TVProps = {
  freq: number;                   // 88.0..108.0 (raw, for display ticker)
  snappedFreq: number;            // freq snapped to 0.1
  snowLevel: number;              // 0..1 — 0 = clear picture, 1 = full snow
  channelName?: string;
  subtitle?: string;
  imageUrl?: string;
  caption?: string;               // displayed under chyron when no signal / loading
  onPointerDown: (e: React.PointerEvent) => void;
  showHint: boolean;
  hintText: string;
};

export default function TV({
  freq, snappedFreq, snowLevel, channelName, subtitle, imageUrl, caption,
  onPointerDown, showHint, hintText,
}: TVProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 120, H = 90;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    let raf = 0;
    const draw = () => {
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * 255) | 0;
        data[i] = n;
        data[i + 1] = n;
        data[i + 2] = n;
        data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Smooth the displayed freq slightly so the ticker is steady at-rest but
  // legible mid-drag (display rounds to one decimal regardless).
  const displayFreq = freq.toFixed(1);
  const snowAlpha = Math.max(0.04, Math.min(1, snowLevel));

  return (
    <div className="sc-tv">
      <div className="sc-tv__cab" onPointerDown={onPointerDown}>
        <div className="sc-tv__screen">
          {imageUrl ? (
            <img
              className="sc-tv__pic"
              src={imageUrl}
              alt=""
              draggable={false}
              style={{ opacity: 1 - snowAlpha * 0.85 }}
            />
          ) : null}

          <canvas
            ref={canvasRef}
            className="sc-tv__snow"
            style={{ opacity: snowAlpha }}
          />

          <div className="sc-tv__chyron sc-tv__chyron--top">
            <span className="sc-tv__freq">{displayFreq} <em>MHz</em></span>
            {channelName && snowLevel < 0.5 && (
              <span className="sc-tv__call">{channelName}</span>
            )}
          </div>

          {snowLevel < 0.4 && subtitle && (
            <div className="sc-tv__chyron sc-tv__chyron--bot">
              <span className="sc-tv__sub">{subtitle}</span>
            </div>
          )}

          {caption && (
            <div className="sc-tv__caption">{caption}</div>
          )}

          {showHint && (
            <div className="sc-tv__hint" role="status" aria-live="polite">
              <span>{hintText}</span>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          <div className="sc-tv__scanlines" />
          <div className="sc-tv__vignette" />
          <div className="sc-tv__glare" />
        </div>
        <div className="sc-tv__bezel-bottom">
          <span className="sc-tv__brand">STATIC CHANNEL</span>
          <span className="sc-tv__freq-mini">{snappedFreq.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
