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
  Promotion,
  Reaction,
  Segment,
  SegmentWithAuthor,
} from '../types';
import { freqKey, migrateSave, sameFreq, segKey } from '../types';

// Per-segment "I'm listening" tally: how many distinct users reacted, and
// whether the current user is one of them.
export type ReactionTally = { count: number; mine: boolean };

// Weighted interaction score that tips a channel into "Going Live".
const W_KEEP = 1;
const W_LISTEN = 1;
const W_CONTINUE = 2;   // someone else staying on the air is the heaviest signal

interface RawRow {
  user_id: string;
  user_name?: string;
  user_avatar_url?: string;
  head_url?: string;
  time?: string;
  resource_data: string;
}

export function useWall(
  mySegments: Segment[],
  myReactions: Reaction[],
  myBookmarks: Bookmark[],
  myPromotions: Promotion[],
) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [recent, setRecent] = useState<SegmentWithAuthor[]>([]);
  const [reactionTally, setReactionTally] = useState<Map<string, ReactionTally>>(new Map());
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const myId = telegramId ?? 'me';
    const sessionId = getGameUuid();
    if (!isInAigram || !sessionId) {
      // Offline / preview — still surface our own data locally.
      const tally = tallyReactions([], myReactions);
      setReactionTally(tally);
      const all = mySegments.map(s => withAuthor(s, myId, 'YOU'));
      const keepers = new Map<string, Set<string>>();
      addKeepers(keepers, myBookmarks, myId);
      const promos = new Map<string, Promotion>();
      addPromos(promos, myPromotions);
      setBroadcasts(buildBroadcasts(all, tally, keepers, promos));
      setRecent(buildRecent(all));
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
      const otherReactions: Reaction[] = [];
      const keepers = new Map<string, Set<string>>();   // freqKey → user ids who kept it
      const promos = new Map<string, Promotion>();       // segKey → best promotion
      for (const r of rows) {
        if (!r.resource_data) continue;
        const isSelf = r.user_id === telegramId;
        // Skip self segments — we render self-authored segments from local
        // `mySegments` to avoid round-trip lag right after publishing.
        if (isSelf) continue;
        let payload;
        try {
          payload = migrateSave(JSON.parse(r.resource_data));
        } catch (_) {
          continue;
        }
        for (const s of payload.segments ?? []) {
          if (!s || typeof s.freq !== 'number' || !s.imageUrl) continue;
          all.push(withAuthor(s, r.user_id, r.user_name || 'broadcaster', r.head_url || r.user_avatar_url || undefined));
        }
        for (const rx of payload.reactions ?? []) otherReactions.push(rx);
        addKeepers(keepers, payload.bookmarks ?? [], r.user_id);
        addPromos(promos, payload.promotions ?? []);
      }
      // Splice in our own data so it counts + appears instantly.
      for (const s of mySegments) all.push(withAuthor(s, myId, 'YOU'));
      addKeepers(keepers, myBookmarks, myId);
      addPromos(promos, myPromotions);

      const tally = tallyReactions(otherReactions, myReactions);
      setReactionTally(tally);
      setBroadcasts(buildBroadcasts(all, tally, keepers, promos));
      setRecent(buildRecent(all));
    } catch (_) {
      // network / bridge — keep stale data
    } finally {
      setLoaded(true);
    }
  // Inputs captured by reference each refresh; deps include them so callers get
  // a fresh closure when their content (and thus identity) changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySegments, myReactions, myBookmarks, myPromotions]);

  useEffect(() => { refresh(); }, [refresh]);

  return { broadcasts, recent, reactionTally, loaded, refresh };
}

function withAuthor(s: Segment, authorId: string, authorName: string, authorAvatarUrl?: string): SegmentWithAuthor {
  return { ...s, authorId, authorName, authorAvatarUrl };
}

function addKeepers(map: Map<string, Set<string>>, bookmarks: Bookmark[], userId: string) {
  for (const b of bookmarks) {
    if (!b || typeof b.freq !== 'number') continue;
    const k = freqKey(b.freq);
    const set = map.get(k) ?? new Set<string>();
    set.add(userId);
    map.set(k, set);
  }
}

const promoRank = (s: Promotion['status']) => (s === 'success' ? 2 : s === 'processing' ? 1 : 0);
function addPromos(map: Map<string, Promotion>, promotions: Promotion[]) {
  for (const p of promotions) {
    const k = segKey(p.freq, p.segTs);
    const cur = map.get(k);
    if (!cur || promoRank(p.status) > promoRank(cur.status) || (promoRank(p.status) === promoRank(cur.status) && p.ts > cur.ts)) {
      map.set(k, p);
    }
  }
}

function tallyReactions(others: Reaction[], mine: Reaction[]): Map<string, ReactionTally> {
  const map = new Map<string, ReactionTally>();
  for (const r of others) {
    const k = segKey(r.freq, r.segTs);
    const cur = map.get(k);
    if (cur) cur.count += 1;
    else map.set(k, { count: 1, mine: false });
  }
  for (const r of mine) {
    const k = segKey(r.freq, r.segTs);
    const cur = map.get(k);
    if (cur) { cur.count += 1; cur.mine = true; }
    else map.set(k, { count: 1, mine: true });
  }
  return map;
}

function buildBroadcasts(
  all: SegmentWithAuthor[],
  tally: Map<string, ReactionTally>,
  keepers: Map<string, Set<string>>,
  promos: Map<string, Promotion>,
): Broadcast[] {
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

    // Going Live score — author-agnostic property of the channel.
    const keeperSet = keepers.get(freqKey(anchor.freq));
    let keeps = keeperSet ? keeperSet.size : 0;
    if (keeperSet && keeperSet.has(anchor.authorId)) keeps -= 1;   // the author keeping their own doesn't count
    let listens = 0;
    for (const s of arr) listens += tally.get(segKey(s.freq, s.ts))?.count ?? 0;
    const continues = arr.filter(s => s.authorId !== anchor.authorId).length;
    const liveScore = Math.max(0, keeps) * W_KEEP + listens * W_LISTEN + continues * W_CONTINUE;

    // Promotion (anchor still → clip).
    const promo = promos.get(segKey(anchor.freq, anchor.ts));
    const videoUrl = promo?.status === 'success' ? promo.videoUrl : undefined;
    if (videoUrl) anchor.videoUrl = videoUrl;   // anchor === arr[0], mutated in place

    out.push({
      freq: anchor.freq,
      channelName: anchor.channelName,
      anchor,
      segments: arr,
      latest,
      segmentCount: arr.length,
      lastTs: latest.ts,
      liveScore,
      videoUrl,
      promotion: promo,
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
