// Static Channel — late-night radio dial across an AI-broadcast FM band.
// Drag the screen (or the dial below) to tune. When you land on a freq, the
// signal is generated (if new) or replayed (if someone else has already been
// here). KEEP saves it to your bookmarks; STAY ON AIR adds your own next
// segment, turning the freq into a thread other listeners can dial into.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './StaticChannel.less';
import TV from './components/TV';
import Dial from './components/Dial';
import Wall from './components/Wall';
import TopTicker from './components/TopTicker';
import StayOnAir from './components/StayOnAir';
import { t } from './i18n';
import { useChannelCache } from './hooks/useChannelCache';
import { useChannel } from './hooks/useChannel';
import { useTuner } from './hooks/useTuner';
import { useWall, unseenCount } from './hooks/useWall';
import { useGameSave } from '@shared/save';
import { telegramId } from '@shared/runtime';
import { installGlobalTapFeedback, isMuted, setMuted } from './utils/audio';
import type { Bookmark, Channel, SavePayload, Segment } from './types';
import { migrateSave, sameFreq, snapFreq } from './types';

const GAME_ID = 'static-channel';
const SEGMENT_CAP = 64;
const BOOKMARK_CAP = 24;

function pickInitialFreq(): number {
  const params = new URLSearchParams(window.location.search);
  const f = parseFloat(params.get('freq') || '');
  if (Number.isFinite(f) && f >= 88 && f <= 108) return snapFreq(f);
  return snapFreq(88 + Math.random() * 20);
}

export default function StaticChannel() {
  const cache = useChannelCache();
  const channelGen = useChannel();

  // Persisted state — mirror pattern (read once on mount, write through persist).
  const save = useGameSave<SavePayload>(GAME_ID);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (save.savedData === undefined) return;
    hydratedRef.current = true;
    const migrated = migrateSave(save.savedData);
    setSegments((migrated.segments ?? []).slice(0, SEGMENT_CAP));
    setBookmarks((migrated.bookmarks ?? []).slice(0, BOOKMARK_CAP));
  }, [save.savedData]);

  const persist = useCallback((nextSegs: Segment[], nextBookmarks: Bookmark[]) => {
    setSegments(nextSegs);
    setBookmarks(nextBookmarks);
    save.persist({ segments: nextSegs, bookmarks: nextBookmarks });
  }, [save]);

  // Cross-user wall + ticker.
  const wall = useWall(segments);
  const [wallOpen, setWallOpen] = useState(false);

  // Tuner.
  const [hintVisible, setHintVisible] = useState(true);
  const [muted, setMutedState] = useState(isMuted());

  const onSettle = useCallback((freq: number) => {
    // If someone else (or we) have already broadcast here, don't regenerate —
    // tune INTO their station.
    const existing = wall.broadcasts.find(b => sameFreq(b.freq, freq));
    if (existing) {
      cache.set({
        freq: existing.freq,
        channelName: existing.channelName,
        subtitle: existing.latest.subtitle,
        imageUrl: existing.latest.imageUrl,
      });
      return;
    }
    if (cache.get(freq)) return;
    channelGen.fetchChannel(freq).then(ch => {
      if (ch) cache.set(ch);
    });
  }, [cache, channelGen, wall.broadcasts]);

  const onFirstTouch = useCallback(() => setHintVisible(false), []);

  const tuner = useTuner(pickInitialFreq(), { onSettle, onFirstTouch });

  useEffect(() => { installGlobalTapFeedback(); }, []);

  const snapped = tuner.state.snapped;
  const activeBroadcast = useMemo(
    () => wall.broadcasts.find(b => sameFreq(b.freq, snapped)),
    [wall.broadcasts, snapped],
  );
  const activeChannel: Channel | null = useMemo(() => {
    if (activeBroadcast) {
      return {
        freq: activeBroadcast.freq,
        channelName: activeBroadcast.channelName,
        subtitle: activeBroadcast.latest.subtitle,
        imageUrl: activeBroadcast.latest.imageUrl,
      };
    }
    return cache.get(snapped);
  }, [activeBroadcast, cache, snapped]);

  // When the user lands on a bookmarked freq, advance the lastSeenTs so the
  // red dot clears.
  useEffect(() => {
    if (tuner.state.isDragging || tuner.state.isSettling) return;
    if (!activeBroadcast) return;
    const idx = bookmarks.findIndex(b => sameFreq(b.freq, snapped));
    if (idx < 0) return;
    const latestTs = activeBroadcast.lastTs;
    if (bookmarks[idx].lastSeenTs >= latestTs) return;
    const next = [...bookmarks];
    next[idx] = { freq: snapped, lastSeenTs: latestTs };
    persist(segments, next);
  }, [activeBroadcast, snapped, tuner.state.isDragging, tuner.state.isSettling, bookmarks, segments, persist]);

  const snowLevel = useMemo(() => {
    if (tuner.state.isDragging || tuner.state.isSettling) return 1;
    if (activeChannel) return 0.06;       // extending keeps the prior picture visible
    const s = channelGen.status;
    if (s.phase === 'meta'  && s.freq === snapped) return 0.95;
    if (s.phase === 'image' && s.freq === snapped) return 0.75;
    if (s.phase === 'error' && s.freq === snapped) return 1;
    return 1;
  }, [tuner.state.isDragging, tuner.state.isSettling, activeChannel, channelGen.status, snapped]);

  const caption = useMemo(() => {
    if (activeChannel) return undefined;  // picture is up — chyron speaks
    if (tuner.state.isDragging || tuner.state.isSettling) return t('tuning.snow');
    const s = channelGen.status;
    if (s.phase === 'meta'  && s.freq === snapped) return t('tuning.gen_first');
    if (s.phase === 'image' && s.freq === snapped) {
      if (s.secondsLeft != null) return t('tuning.retry') + ` · ${s.secondsLeft}s`;
      return t('tuning.gen_image');
    }
    if (s.phase === 'error' && s.freq === snapped) return t('tuning.error');
    return t('tuning.snow');
  }, [activeChannel, tuner.state.isDragging, tuner.state.isSettling, channelGen.status, snapped]);

  // ─── KEEP ─────────────────────────────────────────────────────────────
  const alreadyKept = useMemo(
    () => bookmarks.some(b => sameFreq(b.freq, snapped)),
    [bookmarks, snapped],
  );

  const handleKeep = useCallback(() => {
    if (!activeChannel || alreadyKept) return;
    const now = Date.now();
    const nextBookmarks: Bookmark[] = [
      { freq: snapped, lastSeenTs: now },
      ...bookmarks.filter(b => !sameFreq(b.freq, snapped)),
    ].slice(0, BOOKMARK_CAP);

    // If no one (including us) has broadcast here yet, publish our channel
    // as the anchor segment so it shows up cross-user.
    let nextSegs = segments;
    if (!activeBroadcast) {
      const seg: Segment = {
        freq: snapped,
        channelName: activeChannel.channelName,
        subtitle: activeChannel.subtitle,
        imageUrl: activeChannel.imageUrl,
        ts: now,
      };
      nextSegs = [seg, ...segments.filter(s => !sameFreq(s.freq, snapped) || s.ts !== seg.ts)].slice(0, SEGMENT_CAP);
    }
    persist(nextSegs, nextBookmarks);
    // Refresh wall so the ticker / wall picks up our publish if it was an anchor.
    if (!activeBroadcast) wall.refresh();
  }, [activeBroadcast, activeChannel, alreadyKept, bookmarks, persist, segments, snapped, wall]);

  // ─── STAY ON AIR ──────────────────────────────────────────────────────
  const canStay = !!activeBroadcast && channelGen.status.phase !== 'extending' && channelGen.status.phase !== 'meta' && channelGen.status.phase !== 'image';
  const stayBusy = channelGen.status.phase === 'extending' && channelGen.status.freq === snapped;

  const handleStayOnAir = useCallback(async (nudge: string) => {
    if (!activeBroadcast) return;
    const seg = await channelGen.extendChannel({
      freq: activeBroadcast.freq,
      channelName: activeBroadcast.channelName,
      priorSubtitle: activeBroadcast.latest.subtitle,
      nudge,
    });
    if (!seg) return;
    // Mirror update: append our authored segment + bookmark (we just added to it).
    const nextSegs = [seg, ...segments].slice(0, SEGMENT_CAP);
    const nextBookmarks: Bookmark[] = [
      { freq: seg.freq, lastSeenTs: seg.ts },
      ...bookmarks.filter(b => !sameFreq(b.freq, seg.freq)),
    ].slice(0, BOOKMARK_CAP);
    // Surface our new segment immediately on the TV via the cache.
    cache.set({ freq: seg.freq, channelName: seg.channelName, subtitle: seg.subtitle, imageUrl: seg.imageUrl });
    persist(nextSegs, nextBookmarks);
    wall.refresh();
  }, [activeBroadcast, bookmarks, cache, channelGen, persist, segments, wall]);

  // ─── Wall jump ────────────────────────────────────────────────────────
  const handleJump = useCallback((freq: number) => {
    const wallHit = wall.broadcasts.find(b => sameFreq(b.freq, freq));
    if (wallHit) {
      cache.set({
        freq: wallHit.freq,
        channelName: wallHit.channelName,
        subtitle: wallHit.latest.subtitle,
        imageUrl: wallHit.latest.imageUrl,
      });
    }
    tuner.jumpTo(freq);
    setWallOpen(false);
  }, [cache, tuner, wall.broadcasts]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }, [muted]);

  const openWall = useCallback(() => {
    setWallOpen(true);
    wall.refresh();
  }, [wall]);

  // Ticker data.
  const tickerLatest = useMemo(() => {
    const myId = telegramId ?? 'me';
    return wall.recent.find(s => s.authorId !== myId);
  }, [wall.recent]);
  const unseen = useMemo(() => unseenCount(wall.broadcasts, bookmarks), [wall.broadcasts, bookmarks]);

  // Segment indicator data for TV.
  const segmentCountForTV = activeBroadcast?.segmentCount;
  const latestAuthorNameForTV = activeBroadcast && activeBroadcast.latest.authorId !== telegramId
    ? activeBroadcast.latest.authorName
    : undefined;

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
        </div>
      </header>

      <div className="sc-ticker-wrap">
        <TopTicker latest={tickerLatest} unseen={unseen} onOpen={openWall} />
      </div>

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
        segmentCount={segmentCountForTV}
        latestAuthorName={latestAuthorNameForTV}
      />

      <Dial
        freq={tuner.state.freq}
        isDragging={tuner.state.isDragging || tuner.state.isSettling}
        onPointerDown={tuner.handlers.onPointerDownDial}
      />

      <StayOnAir
        active={canStay}
        busy={stayBusy}
        onSend={handleStayOnAir}
      />

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
        broadcasts={wall.broadcasts}
        bookmarks={bookmarks}
      />
    </div>
  );
}
