// Cross-user broadcasts. Each user persists segments they authored; the wall
// flattens everyone's segments, groups by freq, and exposes:
//   broadcasts[]      — every freq someone has been on, with all segments
//   recent[]          — newest segments cross-user (drives the top ticker)
//   unseenCount(bm,m) — how many segments on bookmarked freqs are newer than
//                       the user's last-seen timestamp (drives the red dot)

import { useCallback, useEffect, useState } from 'react';
import {
  callAigramAPI,
  isInAigram,
  telegramId,
  type AigramResponse,
} from '@shared/runtime';
import { getGameUuid } from '@shared/runtime';
import type {
  Bookmark,
  Broadcast,
  Segment,
  SegmentWithAuthor,
} from '../types';
import { freqKey, migrateSave, sameFreq } from '../types';

interface RawRow {
  user_id: string;
  user_name?: string;
  user_avatar_url?: string;
  head_url?: string;
  time?: string;
  resource_data: string;
}

export function useWall(mySegments: Segment[]) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [recent, setRecent] = useState<SegmentWithAuthor[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const sessionId = getGameUuid();
    if (!isInAigram || !sessionId) {
      setLoaded(true);
      return;
    }
    try {
      const res = await callAigramAPI<AigramResponse<RawRow[]>>(
        `/note/aigram/ai/game/get/data/list?session_id=${encodeURIComponent(sessionId)}`,
        'GET',
      );
      const rows: RawRow[] = Array.isArray(res?.data) ? res.data : [];
      const all: SegmentWithAuthor[] = [];
      for (const r of rows) {
        if (!r.resource_data) continue;
        const isSelf = r.user_id === telegramId;
        // Skip self — we render self-authored segments from local `mySegments`
        // to avoid round-trip lag right after publishing.
        if (isSelf) continue;
        let payload;
        try {
          payload = migrateSave(JSON.parse(r.resource_data));
        } catch (_) {
          continue;
        }
        const list = payload.segments ?? [];
        for (const s of list) {
          if (!s || typeof s.freq !== 'number' || !s.imageUrl) continue;
          all.push({
            ...s,
            authorId: r.user_id,
            authorName: r.user_name || 'broadcaster',
            authorAvatarUrl: r.head_url || r.user_avatar_url || undefined,
          });
        }
      }
      // Splice in our own authored segments so they appear instantly.
      for (const s of mySegments) {
        all.push({
          ...s,
          authorId: telegramId ?? 'me',
          authorName: 'YOU',  // resolved in UI; the wall hides the name for self anyway
          authorAvatarUrl: undefined,
        });
      }
      const grouped = groupByFreq(all);
      setBroadcasts(grouped);
      setRecent(buildRecent(all));
    } catch (_) {
      // network / bridge — keep stale data
    } finally {
      setLoaded(true);
    }
  // mySegments is intentionally captured by reference each refresh; deps left
  // empty so callers can call refresh() at any moment without re-creating it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySegments]);

  useEffect(() => { refresh(); }, [refresh]);

  return { broadcasts, recent, loaded, refresh };
}

function groupByFreq(all: SegmentWithAuthor[]): Broadcast[] {
  const buckets = new Map<string, SegmentWithAuthor[]>();
  for (const s of all) {
    const k = freqKey(s.freq);
    const arr = buckets.get(k);
    if (arr) arr.push(s);
    else buckets.set(k, [s]);
  }
  const out: Broadcast[] = [];
  for (const arr of buckets.values()) {
    arr.sort((a, b) => a.ts - b.ts);   // oldest → newest
    const anchor = arr[0];
    const latest = arr[arr.length - 1];
    out.push({
      freq: anchor.freq,
      channelName: anchor.channelName,
      anchor,
      segments: arr,
      latest,
      segmentCount: arr.length,
      lastTs: latest.ts,
    });
  }
  out.sort((a, b) => b.lastTs - a.lastTs);
  return out;
}

function buildRecent(all: SegmentWithAuthor[]): SegmentWithAuthor[] {
  const sorted = [...all].sort((a, b) => b.ts - a.ts);
  // Dedup per freq for the ticker (only the newest segment per freq).
  const seen = new Set<string>();
  const out: SegmentWithAuthor[] = [];
  for (const s of sorted) {
    const k = freqKey(s.freq);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= 12) break;
  }
  return out;
}

// Count segments on freqs the user has bookmarked that are newer than the
// user's lastSeenTs for that freq.
export function unseenCount(broadcasts: Broadcast[], bookmarks: Bookmark[]): number {
  if (bookmarks.length === 0) return 0;
  let n = 0;
  for (const b of broadcasts) {
    const bm = bookmarks.find(x => sameFreq(x.freq, b.freq));
    if (!bm) continue;
    for (const seg of b.segments) {
      // Only count segments by OTHER users (the user already knows their own).
      if (seg.authorId === telegramId) continue;
      if (seg.ts > bm.lastSeenTs) n++;
    }
  }
  return n;
}
