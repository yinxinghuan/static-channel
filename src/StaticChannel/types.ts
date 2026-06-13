export type Channel = {
  freq: number;          // e.g. 91.7 — primary key, 0.1 MHz step
  channelName: string;   // 'WGRT-7'
  subtitle: string;      // 'a wedding from 1987, nobody is dancing yet'
  imageUrl: string;
};

// Backwards-compat alias — old saves wrote this shape.
export type SavedChannel = Channel & { ts: number };

// A single program segment on a frequency — authored by one user.
// First segment at a freq = the anchor (set the channelName).
export type Segment = {
  freq: number;
  channelName: string;
  subtitle: string;
  imageUrl: string;
  ts: number;            // epoch ms when authored
};

export type SegmentWithAuthor = Segment & {
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  videoUrl?: string;     // set when this segment has been promoted to a clip
};

// Derived view: all segments at a freq, in chronological order.
export type Broadcast = {
  freq: number;
  channelName: string;   // anchor's
  anchor: SegmentWithAuthor;
  segments: SegmentWithAuthor[];  // includes anchor at [0], sorted oldest→newest
  latest: SegmentWithAuthor;
  segmentCount: number;
  lastTs: number;
  liveScore: number;     // weighted cross-user interaction score (drives Going Live)
  videoUrl?: string;     // the anchor's promoted clip, once baked
  promotion?: Promotion; // merged best promotion record for the anchor, if any
};

// Legacy wall-row shape (kept for places not yet migrated).
export type WallEntry = SavedChannel & {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
};

export type Bookmark = {
  freq: number;
  lastSeenTs: number;
};

// A lightweight "I'm listening" reaction the user left on someone's segment.
// (freq, segTs) identifies the target segment across the band.
export type Reaction = {
  freq: number;
  segTs: number;         // ts of the segment being reacted to
  ts: number;            // when the reaction was left
};

// A channel that drew enough interaction gets promoted from a still to a short
// looping clip. The bake runs server-side (task_id) and is resumable from any
// client; whoever publishes a successful Promotion makes the channel "live" for
// everyone. (freq, segTs) targets the promoted segment (the anchor still).
export type Promotion = {
  freq: number;
  segTs: number;
  taskId: string;
  videoUrl?: string;     // set once the bake succeeds
  status: 'processing' | 'success' | 'failed';
  ts: number;
};

// New persisted shape per user.
export type SavePayload = {
  segments?: Segment[];
  bookmarks?: Bookmark[];
  reactions?: Reaction[];
  promotions?: Promotion[];
};

// Old persisted shape — read-only migration only.
export type LegacySavePayload = {
  channels?: SavedChannel[];
};

// Coerce either shape into the new one. Old `channels` become segments,
// each treated as the user's authored anchor at that freq.
export function migrateSave(raw: unknown): SavePayload {
  const r = (raw ?? {}) as SavePayload & LegacySavePayload;
  const reactions: Reaction[] = Array.isArray(r.reactions) ? r.reactions.filter(isValidReaction) : [];
  const promotions: Promotion[] = Array.isArray(r.promotions) ? r.promotions.filter(isValidPromotion) : [];
  const segs: Segment[] = Array.isArray(r.segments) ? r.segments.filter(isValidSegment) : [];
  if (segs.length > 0) {
    return {
      segments: segs,
      bookmarks: Array.isArray(r.bookmarks) ? r.bookmarks.filter(isValidBookmark) : [],
      reactions,
      promotions,
    };
  }
  const legacy: Segment[] = Array.isArray(r.channels)
    ? r.channels
        .filter(c => c && typeof c.freq === 'number' && c.imageUrl)
        .map(c => ({
          freq: c.freq,
          channelName: c.channelName,
          subtitle: c.subtitle,
          imageUrl: c.imageUrl,
          ts: c.ts ?? Date.now(),
        }))
    : [];
  return {
    segments: legacy,
    bookmarks: legacy.map(s => ({ freq: s.freq, lastSeenTs: s.ts })),
    reactions,
    promotions,
  };
}

function isValidSegment(s: unknown): s is Segment {
  if (!s || typeof s !== 'object') return false;
  const x = s as Segment;
  return (
    typeof x.freq === 'number' &&
    typeof x.channelName === 'string' &&
    typeof x.subtitle === 'string' &&
    typeof x.imageUrl === 'string' &&
    typeof x.ts === 'number'
  );
}

function isValidBookmark(b: unknown): b is Bookmark {
  if (!b || typeof b !== 'object') return false;
  const x = b as Bookmark;
  return typeof x.freq === 'number' && typeof x.lastSeenTs === 'number';
}

function isValidReaction(r: unknown): r is Reaction {
  if (!r || typeof r !== 'object') return false;
  const x = r as Reaction;
  return typeof x.freq === 'number' && typeof x.segTs === 'number' && typeof x.ts === 'number';
}

function isValidPromotion(p: unknown): p is Promotion {
  if (!p || typeof p !== 'object') return false;
  const x = p as Promotion;
  return (
    typeof x.freq === 'number' &&
    typeof x.segTs === 'number' &&
    typeof x.taskId === 'string' &&
    (x.status === 'processing' || x.status === 'success' || x.status === 'failed') &&
    typeof x.ts === 'number'
  );
}

// Identity key for a segment / reaction target: "97.3:1700000000000".
export function segKey(freq: number, segTs: number): string {
  return `${snapFreq(freq).toFixed(1)}:${segTs}`;
}

export const FREQ_MIN = 88.0;
export const FREQ_MAX = 108.0;
export const FREQ_STEP = 0.1;

export function clampFreq(f: number): number {
  if (!Number.isFinite(f)) return FREQ_MIN;
  return Math.max(FREQ_MIN, Math.min(FREQ_MAX, f));
}

export function snapFreq(f: number): number {
  const stepped = Math.round((f - FREQ_MIN) / FREQ_STEP) * FREQ_STEP + FREQ_MIN;
  return Math.round(stepped * 10) / 10;
}

export function freqKey(f: number): string {
  return snapFreq(f).toFixed(1);
}

export function sameFreq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}
