// Static Channel — late-night radio dial across an AI-broadcast FM band that is
// also a TIMELINE of media (silent film → westerns → early TV → VHS → dead-hours
// → the digital feed), all corrupted by something with intent. Drag the screen
// (or the dial below) to tune. KEEP saves a channel; STAY ON AIR appends your own
// next segment, turning the freq into a thread others can dial into; tap LISTEN
// to leave an "I'm listening" mark on whatever segment is on screen. Every social
// act pings the author via a platform notification.

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
import { telegramId, useGameEvent } from '@shared/runtime';
import { installGlobalTapFeedback, isMuted, setMuted } from './utils/audio';
import { describeFreq, signalDefects } from './utils/bands';
import { timeAgo } from './utils/timeAgo';
import type { Bookmark, Channel, Reaction, SavePayload, Segment } from './types';
import { migrateSave, sameFreq, segKey, snapFreq } from './types';

const GAME_ID = 'static-channel';
const SEGMENT_CAP = 64;
const BOOKMARK_CAP = 24;
const REACTION_CAP = 96;

const NOTIFY_IMAGE_PROMPT = 'a corrupted late-night TV broadcast still';

function pickInitialFreq(): number {
  const params = new URLSearchParams(window.location.search);
  const f = parseFloat(params.get('freq') || '');
  if (Number.isFinite(f) && f >= 88 && f <= 108) return snapFreq(f);
  return snapFreq(88 + Math.random() * 20);
}

type NotifyAction = {
  type: 'notify';
  target_user_id: string;
  image?: { ref_url: string; prompt: string };
  message: { template: string; variables: string[] };
};

function notifyAction(targetUserId: string, imageUrl: string | undefined, template: string): NotifyAction {
  const action: NotifyAction = {
    type: 'notify',
    target_user_id: targetUserId,
    message: { template, variables: ['sender_name'] },
  };
  if (imageUrl) action.image = { ref_url: imageUrl, prompt: NOTIFY_IMAGE_PROMPT };
  return action;
}

export default function StaticChannel() {
  const cache = useChannelCache();
  const channelGen = useChannel();
  const events = useGameEvent();
  const myId = telegramId ?? 'me';

  // Persisted state — mirror pattern (read once on mount, write through persist).
  const save = useGameSave<SavePayload>(GAME_ID);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (save.savedData === undefined) return;
    hydratedRef.current = true;
    const migrated = migrateSave(save.savedData);
    setSegments((migrated.segments ?? []).slice(0, SEGMENT_CAP));
    setBookmarks((migrated.bookmarks ?? []).slice(0, BOOKMARK_CAP));
    setReactions((migrated.reactions ?? []).slice(0, REACTION_CAP));
  }, [save.savedData]);

  // Single persist entry point — merges a partial update over current state and
  // writes the whole payload through (savedData never echoes writes back).
  const stateRef = useRef({ segments, bookmarks, reactions });
  stateRef.current = { segments, bookmarks, reactions };
  const persist = useCallback((next: Partial<SavePayload>) => {
    const merged = { ...stateRef.current, ...next };
    setSegments(merged.segments);
    setBookmarks(merged.bookmarks);
    setReactions(merged.reactions);
    save.persist(merged);
  }, [save]);

  // Cross-user wall + ticker + reaction tallies.
  const wall = useWall(segments, reactions);
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

  // The dial's geography for the current spot — drives the analog defects.
  const desc = useMemo(() => describeFreq(snapped), [snapped]);
  const defects = useMemo(() => signalDefects(desc.dread, desc.cursed), [desc.dread, desc.cursed]);

  // ─── Segment navigation (history timeline) ──────────────────────────────
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(0);
  const wasOnLatestRef = useRef(true);
  const prevFreqRef = useRef(snapped);
  const prevCountRef = useRef(0);
  const segmentCount = activeBroadcast?.segmentCount ?? 0;

  useEffect(() => {
    if (prevFreqRef.current !== snapped) {
      prevFreqRef.current = snapped;
      prevCountRef.current = segmentCount;
      wasOnLatestRef.current = true;
      setActiveSegmentIdx(Math.max(0, segmentCount - 1));
      return;
    }
    if (prevCountRef.current !== segmentCount) {
      if (wasOnLatestRef.current) {
        setActiveSegmentIdx(Math.max(0, segmentCount - 1));
      } else {
        setActiveSegmentIdx((i) => Math.min(i, Math.max(0, segmentCount - 1)));
      }
      prevCountRef.current = segmentCount;
    }
  }, [snapped, segmentCount]);

  const activeSegment = useMemo(
    () => activeBroadcast?.segments[activeSegmentIdx],
    [activeBroadcast, activeSegmentIdx],
  );

  const activeChannel: Channel | null = useMemo(() => {
    if (activeSegment) {
      return {
        freq: activeSegment.freq,
        channelName: activeSegment.channelName,
        subtitle: activeSegment.subtitle,
        imageUrl: activeSegment.imageUrl,
      };
    }
    return cache.get(snapped);
  }, [activeSegment, cache, snapped]);

  const handleSegmentTap = useCallback((idx: number) => {
    setActiveSegmentIdx(idx);
    wasOnLatestRef.current = (idx === segmentCount - 1);
  }, [segmentCount]);

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
    persist({ bookmarks: next });
  }, [activeBroadcast, snapped, tuner.state.isDragging, tuner.state.isSettling, bookmarks, persist]);

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
    persist({ segments: nextSegs, bookmarks: nextBookmarks });

    // Notify the channel's anchor author that someone kept their station.
    if (activeBroadcast) {
      const anchorId = activeBroadcast.anchor.authorId;
      if (anchorId && anchorId !== myId && anchorId !== 'me') {
        events.trigger(`keep:${snapped.toFixed(1)}`, {
          actions: [notifyAction(anchorId, activeChannel.imageUrl, t('notify.keep', { f: snapped.toFixed(1) }))],
        });
      }
    } else {
      // We just published the anchor — refresh so the ticker/wall pick it up.
      wall.refresh();
    }
  }, [activeBroadcast, activeChannel, alreadyKept, bookmarks, persist, segments, snapped, wall, events, myId]);

  // ─── STAY ON AIR ──────────────────────────────────────────────────────
  const canStay = !!activeBroadcast && channelGen.status.phase !== 'extending' && channelGen.status.phase !== 'meta' && channelGen.status.phase !== 'image';
  const stayBusy = channelGen.status.phase === 'extending' && channelGen.status.freq === snapped;

  const handleStayOnAir = useCallback(async (nudge: string) => {
    if (!activeBroadcast) return;
    const priorSubtitle = activeSegment?.subtitle ?? activeBroadcast.latest.subtitle;
    // Targets to ping: the channel's anchor author + the author of the segment
    // we are continuing from. Dedup, skip ourselves.
    const targets = Array.from(new Set([activeBroadcast.anchor.authorId, activeSegment?.authorId]))
      .filter((id): id is string => !!id && id !== myId && id !== 'me');

    const seg = await channelGen.extendChannel({
      freq: activeBroadcast.freq,
      channelName: activeBroadcast.channelName,
      priorSubtitle,
      nudge,
    });
    if (!seg) return;
    const nextSegs = [seg, ...segments].slice(0, SEGMENT_CAP);
    const nextBookmarks: Bookmark[] = [
      { freq: seg.freq, lastSeenTs: seg.ts },
      ...bookmarks.filter(b => !sameFreq(b.freq, seg.freq)),
    ].slice(0, BOOKMARK_CAP);
    cache.set({ freq: seg.freq, channelName: seg.channelName, subtitle: seg.subtitle, imageUrl: seg.imageUrl });
    wasOnLatestRef.current = true;
    persist({ segments: nextSegs, bookmarks: nextBookmarks });
    wall.refresh();

    if (targets.length) {
      events.trigger(`continue:${seg.freq.toFixed(1)}`, {
        actions: targets.map(id => notifyAction(id, seg.imageUrl, t('notify.continue', { f: seg.freq.toFixed(1) }))),
      });
    }
  }, [activeBroadcast, activeSegment, bookmarks, cache, channelGen, persist, segments, wall, events, myId]);

  // ─── I'M LISTENING (lightweight per-segment reaction) ───────────────────
  const activeSegKey = activeSegment ? segKey(activeSegment.freq, activeSegment.ts) : '';
  const activeReacted = useMemo(
    () => !!activeSegKey && reactions.some(r => segKey(r.freq, r.segTs) === activeSegKey),
    [activeSegKey, reactions],
  );
  const listenCount = useMemo(() => {
    if (!activeSegKey) return 0;
    const tally = wall.reactionTally.get(activeSegKey);
    const others = tally ? tally.count - (tally.mine ? 1 : 0) : 0;
    return others + (activeReacted ? 1 : 0);
  }, [activeSegKey, wall.reactionTally, activeReacted]);
  const canListen = !!activeSegment && !tuner.state.isDragging && !tuner.state.isSettling;

  const handleListen = useCallback(() => {
    if (!activeSegment) return;
    const key = segKey(activeSegment.freq, activeSegment.ts);
    if (reactions.some(r => segKey(r.freq, r.segTs) === key)) {
      // toggle off — silent (no un-notify)
      persist({ reactions: reactions.filter(r => segKey(r.freq, r.segTs) !== key) });
      return;
    }
    const rx: Reaction = { freq: activeSegment.freq, segTs: activeSegment.ts, ts: Date.now() };
    persist({ reactions: [rx, ...reactions].slice(0, REACTION_CAP) });

    const target = activeSegment.authorId;
    if (target && target !== myId && target !== 'me' && activeSegment.imageUrl) {
      events.trigger(`listen:${key}`, {
        actions: [notifyAction(target, activeSegment.imageUrl, t('notify.listen', { f: activeSegment.freq.toFixed(1) }))],
      });
    }
  }, [activeSegment, reactions, persist, events, myId]);

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
    wasOnLatestRef.current = true;
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
    return wall.recent.find(s => s.authorId !== myId);
  }, [wall.recent, myId]);
  const unseen = useMemo(() => unseenCount(wall.broadcasts, bookmarks), [wall.broadcasts, bookmarks]);

  // "Your signal reached someone" — a freq where I have a segment AND someone
  // else added a newer one. The in-game payoff of the notification.
  const tuneBack = useMemo(() => {
    let best: { freq: number; ts: number } | null = null;
    for (const b of wall.broadcasts) {
      const mine = b.segments.filter(s => s.authorId === myId);
      if (!mine.length) continue;
      const myLatest = Math.max(...mine.map(s => s.ts));
      const newer = b.segments.filter(s => s.authorId !== myId && s.ts > myLatest);
      if (!newer.length) continue;
      const ts = Math.max(...newer.map(s => s.ts));
      if (!best || ts > best.ts) best = { freq: b.freq, ts };
    }
    return best;
  }, [wall.broadcasts, myId]);
  const showTuneBack = !!tuneBack && !sameFreq(tuneBack.freq, snapped) && !tuner.state.isDragging && !tuner.state.isSettling;

  // Segment nav.
  const segNav = useMemo(() => {
    if (!activeBroadcast || activeBroadcast.segmentCount < 2 || !activeSegment) return undefined;
    return {
      count: activeBroadcast.segmentCount,
      activeIdx: activeSegmentIdx,
      activeAuthor: activeSegment.authorId === telegramId ? t('wall.you') : activeSegment.authorName,
      activeAgoLabel: timeAgo(activeSegment.ts),
      onTapDot: handleSegmentTap,
    };
  }, [activeBroadcast, activeSegment, activeSegmentIdx, handleSegmentTap]);

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

      {showTuneBack && tuneBack && (
        <div className="sc-tuneback-wrap">
          <button className="sc-tuneback" onClick={() => handleJump(tuneBack.freq)}>
            <span className="sc-tuneback__dot" aria-hidden="true">◉</span>
            <span className="sc-tuneback__text">{t('tuneback.label', { f: tuneBack.freq.toFixed(1) })}</span>
            <span className="sc-tuneback__arrow" aria-hidden="true">→</span>
          </button>
        </div>
      )}

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
        segNav={segNav}
        defects={defects}
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
        <button
          className={`sc-listen ${activeReacted ? 'is-on' : ''}`}
          onClick={handleListen}
          disabled={!canListen}
          aria-label={t('listen.label')}
        >
          <span className="sc-listen__eye" aria-hidden="true">{activeReacted ? '◉' : '◯'}</span>
          <span>{activeReacted ? t('listen.on') : t('listen.label')}{listenCount > 0 ? ` · ${listenCount}` : ''}</span>
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
