// Per-frequency Channel cache backed by localStorage. The cache is the only
// thing keeping us from re-spending API calls when the user revisits a freq.

import { useCallback, useEffect, useState } from 'react';
import type { Channel } from '../types';
import { freqKey } from '../types';

const LS_KEY = 'static-channel-cache';

type CacheMap = Record<string, Channel>;

let bootstrap: CacheMap | null = null;
function loadBootstrap(): CacheMap {
  if (bootstrap) return bootstrap;
  try {
    const raw = localStorage.getItem(LS_KEY);
    bootstrap = raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch (_) {
    bootstrap = {};
  }
  return bootstrap!;
}

export function useChannelCache() {
  const [cache, setCache] = useState<CacheMap>(() => loadBootstrap());

  // Persist (debounced via microtask).
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(cache));
    } catch (_) {}
    bootstrap = cache;
  }, [cache]);

  const get = useCallback((freq: number): Channel | null => {
    return cache[freqKey(freq)] ?? null;
  }, [cache]);

  const set = useCallback((channel: Channel) => {
    setCache(prev => ({ ...prev, [freqKey(channel.freq)]: channel }));
  }, []);

  return { get, set };
}
