// Cross-user "tonight's signals" wall via the platform get/data/list API.
// Each user persists their saved channels through useGameSave; the wall hook
// reads everyone's latest payloads and flattens to per-channel rows.

import { useCallback, useEffect, useState } from 'react';
import {
  callAigramAPI,
  isInAigram,
  telegramId,
  type AigramResponse,
} from '@shared/runtime';
import { getGameUuid } from '@shared/runtime';
import type { SavedChannel, WallEntry } from '../types';

interface RawRow {
  user_id: string;
  user_name?: string;
  user_avatar_url?: string;
  head_url?: string;
  time?: string;
  resource_data: string;
}

interface SavedPayload {
  channels?: SavedChannel[];
}

export function useWall(myChannels: SavedChannel[]) {
  const [entries, setEntries] = useState<WallEntry[]>([]);
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
      const flat: WallEntry[] = [];
      for (const r of rows) {
        if (!r.resource_data) continue;
        if (r.user_id === telegramId) continue; // skip self; we render from local
        let payload: SavedPayload;
        try {
          payload = JSON.parse(r.resource_data) as SavedPayload;
        } catch (_) {
          continue;
        }
        const list = Array.isArray(payload.channels) ? payload.channels : [];
        for (const ch of list) {
          if (!ch || typeof ch.freq !== 'number' || !ch.imageUrl) continue;
          flat.push({
            ...ch,
            userId: r.user_id,
            userName: r.user_name || 'broadcaster',
            userAvatarUrl: r.head_url || r.user_avatar_url || undefined,
          });
        }
      }
      flat.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
      setEntries(flat.slice(0, 24));
    } catch (_) {
      // Network / bridge — keep stale data.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // myChannels is exposed so the page composer can interleave them.
  void myChannels;
  return { entries, loaded, refresh };
}
