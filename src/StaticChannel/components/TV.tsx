// CRT TV. Layers, back-to-front:
//   1. channel <img> (only when locked) + RGB-misconvergence ghost layers
//   2. <canvas> static snow (always rendered; opacity ramps with `snowLevel`)
//   3. analog defects: tracking band, head-switch strip, rolling bar
//   4. scanlines + vignette + glass curve (CSS pseudo-elements)
//   5. chyron overlays — frequency + station name + subtitle
//   6. segment rail (bottom, when broadcast has ≥ 2 segments)
//
// The whole TV is the drag surface — pointerdown is captured here. The dot
// rail's individual dots stopPropagation so tapping a dot doesn't also start
// a frequency drag.
//
// "Defects" make the picture look like a real, failing analog signal instead of
// clean AI art. Their intensity scales with the channel's dread (see bands.ts):
// the dead zone and cursed signals barely hold a picture at all.

import { useEffect, useRef, useState } from 'react';
import './TV.less';
import { t } from '../i18n';

export type TVSegmentNav = {
  count: number;
  activeIdx: number;            // 0..count-1
  activeAuthor?: string;
  activeAgoLabel?: string;      // e.g. "12m" / "2h" / "now"
  onTapDot: (idx: number) => void;
};

// 0..1 per channel — how badly the signal is breaking up.
export type TVDefects = {
  roll: number;       // vertical-hold instability (a dark bar sweeps the picture)
  tracking: number;   // VHS tracking band crossing the screen
  chroma: number;     // RGB misconvergence (red/cyan fringes)
  dropout: number;    // how often the picture momentarily drops to snow
  flicker: number;    // brightness instability
};

export type TVProps = {
  freq: number;                   // 88.0..108.0 (raw, for display ticker)
  snappedFreq: number;            // freq snapped to 0.1
  snowLevel: number;              // 0..1 — 0 = clear picture, 1 = full snow
  channelName?: string;
  subtitle?: string;
  imageUrl?: string;
  videoUrl?: string;              // when the channel has gone live, the looping clip
  caption?: string;               // displayed under chyron when no signal / loading
  onPointerDown: (e: React.PointerEvent) => void;
  showHint: boolean;
  hintText: string;
  // Multi-segment broadcast UI — only rendered when nav.count ≥ 2.
  segNav?: TVSegmentNav;
  // Analog breakup for the current channel.
  defects?: TVDefects;
};

const NO_DEFECTS: TVDefects = { roll: 0, tracking: 0, chroma: 0, dropout: 0, flicker: 0 };

export default function TV({
  freq, snappedFreq, snowLevel, channelName, subtitle, imageUrl, videoUrl, caption,
  onPointerDown, showHint, hintText, segNav, defects = NO_DEFECTS,
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

  // Signal dropout — randomly flash the picture to full snow for a beat. Read
  // the live dropout level from a ref so we keep ONE timer for the component's
  // lifetime instead of churning intervals on every freq change.
  const [dropoutFlash, setDropoutFlash] = useState(false);
  const dropoutRef = useRef(defects.dropout);
  dropoutRef.current = defects.dropout;
  useEffect(() => {
    let flashTimer = 0;
    const id = window.setInterval(() => {
      const p = dropoutRef.current;
      if (p > 0 && Math.random() < p * 0.45) {
        setDropoutFlash(true);
        window.clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => setDropoutFlash(false), 70 + Math.random() * 110);
      }
    }, 620);
    return () => { window.clearInterval(id); window.clearTimeout(flashTimer); };
  }, []);

  const displayFreq = freq.toFixed(1);
  const baseSnow = Math.max(0.04, Math.min(1, snowLevel));
  const snowAlpha = dropoutFlash ? Math.max(baseSnow, 0.82) : baseSnow;

  const pictureUp = (!!imageUrl || !!videoUrl) && snowLevel < 0.45;
  const isLive = !!videoUrl && snowLevel < 0.45;
  const showSegUI = !!segNav && segNav.count >= 2 && snowLevel < 0.4;

  // Defect-driven CSS variables, only meaningful while a picture is up.
  const dx = (pictureUp ? defects.chroma : 0) * 5;            // px of channel misconvergence
  const chromaOn = pictureUp && defects.chroma > 0.06;
  const rollOn = pictureUp && defects.roll > 0.18;
  const trackOn = pictureUp && defects.tracking > 0.12;
  const flickerOn = pictureUp && defects.flicker > 0.3;

  const screenStyle = {
    ['--sc-dx' as string]: `${dx.toFixed(2)}px`,
    ['--sc-roll-dur' as string]: `${(7.5 - defects.roll * 4).toFixed(2)}s`,
    ['--sc-track-dur' as string]: `${(6.5 - defects.tracking * 3).toFixed(2)}s`,
    ['--sc-track-op' as string]: `${(pictureUp ? Math.min(0.85, 0.25 + defects.tracking * 0.7) : 0).toFixed(2)}`,
    ['--sc-head-op' as string]: `${(pictureUp ? Math.min(0.9, 0.3 + defects.tracking * 0.6) : 0).toFixed(2)}`,
  } as React.CSSProperties;

  return (
    <div className="sc-tv">
      {/* zero-size SVG holding the channel-isolation filters for RGB split */}
      <svg className="sc-tv__filters" aria-hidden="true" focusable="false">
        <defs>
          <filter id="sc-keep-red">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          </filter>
          <filter id="sc-keep-cyan">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>

      <div className="sc-tv__cab" onPointerDown={onPointerDown}>
        <div
          className={`sc-tv__screen ${flickerOn ? 'is-flicker' : ''}`}
          style={screenStyle}
        >
          {videoUrl ? (
            <video
              className="sc-tv__pic sc-tv__vid"
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              draggable={false}
              style={{ opacity: 1 - snowAlpha * 0.85 }}
            />
          ) : imageUrl ? (
            <>
              <img
                className="sc-tv__pic"
                src={imageUrl}
                alt=""
                draggable={false}
                style={{ opacity: 1 - snowAlpha * 0.85 }}
              />
              {chromaOn && (
                <>
                  <img
                    className="sc-tv__pic sc-tv__pic--ghost sc-tv__pic--red"
                    src={imageUrl}
                    alt=""
                    draggable={false}
                    style={{ opacity: Math.min(0.7, defects.chroma) * (1 - snowAlpha * 0.85) }}
                  />
                  <img
                    className="sc-tv__pic sc-tv__pic--ghost sc-tv__pic--cyan"
                    src={imageUrl}
                    alt=""
                    draggable={false}
                    style={{ opacity: Math.min(0.7, defects.chroma) * (1 - snowAlpha * 0.85) }}
                  />
                </>
              )}
            </>
          ) : null}

          <canvas
            ref={canvasRef}
            className="sc-tv__snow"
            style={{ opacity: snowAlpha }}
          />

          {trackOn && <div className="sc-tv__tracking" />}
          {trackOn && <div className="sc-tv__headswitch" />}
          {rollOn && <div className="sc-tv__rollbar" />}

          <div className="sc-tv__chyron sc-tv__chyron--top">
            <span className="sc-tv__freq">{displayFreq} <em>MHz</em></span>
            {channelName && snowLevel < 0.5 && (
              <span className="sc-tv__call">{channelName}</span>
            )}
          </div>

          {isLive && (
            <div className="sc-tv__live" aria-label={t('live.badge')}>
              <span className="sc-tv__live-dot" aria-hidden="true" />
              {t('live.badge')}
            </div>
          )}

          {snowLevel < 0.4 && subtitle && (
            <div className="sc-tv__chyron sc-tv__chyron--bot">
              <span className="sc-tv__sub">{subtitle}</span>
            </div>
          )}

          {showSegUI && segNav && (
            <div className="sc-tv__segments" aria-label="segment position">
              <span className="sc-tv__segments-label">
                {t('seg.pos', { i: segNav.activeIdx + 1, n: segNav.count })}
                {segNav.activeAuthor ? ` · ${segNav.activeAuthor}` : ''}
                {segNav.activeAgoLabel ? ` · ${segNav.activeAgoLabel}` : ''}
              </span>
            </div>
          )}

          {showSegUI && segNav && (
            <div className="sc-tv__segtap" aria-hidden="true">
              {t('seg.tap_next')}
            </div>
          )}

          {showSegUI && segNav && (
            <div
              className="sc-tv__segrail"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {Array.from({ length: segNav.count }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`sc-tv__segdot ${i === segNav.activeIdx ? 'is-on' : ''}`}
                  aria-label={t('seg.jump_to', { i: i + 1, n: segNav.count })}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    segNav.onTapDot(i);
                  }}
                />
              ))}
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
