// Static Channel — late-night radio dial across an AI-broadcast FM band.
// Drag the screen to tune; release locks in a channel; heart to keep it;
// open the wall to see what other people pulled in tonight.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './StaticChannel.less';
import TV from './components/TV';
import Dial from './components/Dial';
import Wall from './components/Wall';
import { t } from './i18n';
import { useChannelCache } from './hooks/useChannelCache';
import { useChannel } from './hooks/useChannel';
import { useTuner } from './hooks/useTuner';
import { useWall } from './hooks/useWall';
import { useGameSave } from '@shared/save';
import { installGlobalTapFeedback, isMuted, setMuted } from './utils/audio';
import type { Channel, SavedChannel } from './types';
import { snapFreq } from './types';

const GAME_ID = 'static-channel';
const SAVED_CAP = 12;

type SavePayload = { channels: SavedChannel[] };

function pickInitialFreq(): number {
  const params = new URLSearchParams(window.location.search);
  const f = parseFloat(params.get('freq') || '');
  if (Number.isFinite(f) && f >= 88 && f <= 108) return snapFreq(f);
  // Slight randomness so the very first frame doesn't always feel rigged.
  return snapFreq(88 + Math.random() * 20);
}

export default function StaticChannel() {
  const cache = useChannelCache();
  const channelGen = useChannel();

  // Persisted "kept" list (local-first mirror, written back to platform save).
  const save = useGameSave<SavePayload>(GAME_ID);
  const [mine, setMine] = useState<SavedChannel[]>([]);
  const mineHydratedRef = useRef(false);
  useEffect(() => {
    if (mineHydratedRef.current) return;
    if (save.savedData === undefined) return;
    mineHydratedRef.current = true;
    const ch = save.savedData?.channels ?? [];
    setMine(Array.isArray(ch) ? ch.slice(0, SAVED_CAP) : []);
  }, [save.savedData]);

  // Cross-user wall.
  const wall = useWall(mine);
  const [wallOpen, setWallOpen] = useState(false);

  // Tuner.
  const [hintVisible, setHintVisible] = useState(true);
  const [muted, setMutedState] = useState(isMuted());

  const onSettle = useCallback((freq: number) => {
    const have = cache.get(freq);
    if (have) return;       // already pulled in this signal before
    channelGen.fetchChannel(freq).then(ch => {
      if (ch) cache.set(ch);
    });
  }, [cache, channelGen]);

  const onFirstTouch = useCallback(() => {
    setHintVisible(false);
  }, []);

  const tuner = useTuner(pickInitialFreq(), { onSettle, onFirstTouch });

  // Install global tap feedback once.
  useEffect(() => { installGlobalTapFeedback(); }, []);

  // Active channel = whatever the cache holds for the snapped freq.
  const activeChannel: Channel | null = cache.get(tuner.state.snapped);

  // Snow level: 1 when moving; while a generation for the current freq is
  // in flight, hold somewhere between 0.5 and 0.85 (frames keep peeking
  // through). Once cached, drop to 0.
  const snowLevel = useMemo(() => {
    if (tuner.state.isDragging || tuner.state.isSettling) return 1;
    if (activeChannel) return 0.06;
    const s = channelGen.status;
    if (s.phase === 'meta'  && s.freq === tuner.state.snapped) return 0.95;
    if (s.phase === 'image' && s.freq === tuner.state.snapped) return 0.75;
    if (s.phase === 'error' && s.freq === tuner.state.snapped) return 1;
    return 1;
  }, [tuner.state.isDragging, tuner.state.isSettling, tuner.state.snapped, activeChannel, channelGen.status]);

  // Caption (under chyron) for in-flight or error states.
  const caption = useMemo(() => {
    if (activeChannel) return undefined;
    if (tuner.state.isDragging || tuner.state.isSettling) return t('tuning.snow');
    const s = channelGen.status;
    if (s.phase === 'meta'  && s.freq === tuner.state.snapped) return t('tuning.gen_first');
    if (s.phase === 'image' && s.freq === tuner.state.snapped) {
      if (s.secondsLeft != null) return t('tuning.retry') + ` · ${s.secondsLeft}s`;
      return t('tuning.gen_image');
    }
    if (s.phase === 'error' && s.freq === tuner.state.snapped) return t('tuning.error');
    return t('tuning.snow');
  }, [activeChannel, tuner.state.isDragging, tuner.state.isSettling, tuner.state.snapped, channelGen.status]);

  // ─── Keep current channel ─────────────────────────────────────────────
  const persistMine = useCallback((next: SavedChannel[]) => {
    setMine(next);
    save.persist({ channels: next });
  }, [save]);

  const alreadyKept = useMemo(
    () => activeChannel ? mine.some(m => Math.abs(m.freq - activeChannel.freq) < 0.05) : false,
    [activeChannel, mine],
  );

  const handleKeep = useCallback(() => {
    if (!activeChannel || alreadyKept) return;
    const entry: SavedChannel = { ...activeChannel, ts: Date.now() };
    const next = [entry, ...mine.filter(m => Math.abs(m.freq - entry.freq) >= 0.05)].slice(0, SAVED_CAP);
    persistMine(next);
  }, [activeChannel, alreadyKept, mine, persistMine]);

  // ─── Wall jump ────────────────────────────────────────────────────────
  const handleJump = useCallback((freq: number) => {
    // Seed the cache from the wall entry if we have it (so the picture shows
    // instantly without re-generating). Find the matching wall entry first.
    const wallHit = wall.entries.find(e => Math.abs(e.freq - freq) < 0.05);
    const myHit   = mine.find(m => Math.abs(m.freq - freq) < 0.05);
    const hit = wallHit ?? myHit;
    if (hit) cache.set({ freq: hit.freq, channelName: hit.channelName, subtitle: hit.subtitle, imageUrl: hit.imageUrl });
    tuner.jumpTo(freq);
    setWallOpen(false);
  }, [cache, mine, tuner, wall.entries]);

  // ─── Header buttons ───────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }, [muted]);

  const openWall = useCallback(() => {
    setWallOpen(true);
    wall.refresh();
  }, [wall]);

  return (
    <div className="sc-root">
      <header className="sc-header">
        <div className="sc-header__brand">
          <span className="sc-header__logo">◉</span>
          <span className="sc-header__name">STATIC CHANNEL</span>
        </div>
        <div className="sc-header__actions">
          <button
            className={`sc-iconbtn ${muted ? 'is-off' : ''}`}
            onClick={toggleMute}
            aria-label={muted ? t('mute.off') : t('mute.on')}
          >
            {muted ? '✕' : '♪'}
          </button>
          <button className="sc-iconbtn" onClick={openWall} aria-label={t('nav.wall')}>
            ⌘
          </button>
        </div>
      </header>

      <TV
        freq={tuner.state.freq}
        snappedFreq={tuner.state.snapped}
        snowLevel={snowLevel}
        channelName={activeChannel?.channelName}
        subtitle={activeChannel?.subtitle}
        imageUrl={activeChannel?.imageUrl}
        caption={activeChannel ? undefined : caption}
        onPointerDown={tuner.handlers.onPointerDown}
        showHint={hintVisible && !activeChannel}
        hintText={t('hint.drag')}
      />

      <Dial freq={tuner.state.freq} />

      <div className="sc-footer">
        <button
          className={`sc-keep ${alreadyKept ? 'is-kept' : ''}`}
          onClick={handleKeep}
          disabled={!activeChannel || alreadyKept}
        >
          <span className="sc-keep__heart" aria-hidden="true">{alreadyKept ? '♥' : '♡'}</span>
          <span>{alreadyKept ? t('save.saved') : t('save.keep')}</span>
        </button>
      </div>

      <Wall
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        onJump={handleJump}
        entries={wall.entries}
        mine={mine}
      />
    </div>
  );
}
