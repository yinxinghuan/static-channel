// One LLM call → channelName+subtitle+imagePrompt JSON, then gen-image in
// parallel-ish (gen-image is the slow one, ~30-60s; chat is ~2s).

import { useCallback, useRef, useState } from 'react';
import { useChat, useGenImage } from '@shared/runtime';
import { genImageWithRetry } from '../utils/genImageWithRetry';
import {
  CHANNEL_CHAT_SYSTEM,
  buildImagePrompt,
  parseChannelJSON,
  userPromptForFreq,
} from '../utils/prompts';
import type { Channel } from '../types';
import { snapFreq } from '../types';

export type ChannelGenStatus =
  | { phase: 'idle' }
  | { phase: 'meta'; freq: number }
  | { phase: 'image'; freq: number; subtitle: string; channelName: string; secondsLeft?: number }
  | { phase: 'error'; freq: number; message: string };

export function useChannel() {
  // Fresh chat per call so we don't carry history across frequencies.
  const chat = useChat({ system: CHANNEL_CHAT_SYSTEM, maxHistory: 0 });
  const genImg = useGenImage();
  const [status, setStatus] = useState<ChannelGenStatus>({ phase: 'idle' });
  const inFlightRef = useRef<number | null>(null);

  const fetchChannel = useCallback(
    async (rawFreq: number): Promise<Channel | null> => {
      const freq = snapFreq(rawFreq);
      if (inFlightRef.current === freq) return null;
      inFlightRef.current = freq;
      setStatus({ phase: 'meta', freq });
      try {
        const reply = await chat.send(userPromptForFreq(freq));
        if (inFlightRef.current !== freq) return null;
        const parsed = parseChannelJSON(reply);
        if (!parsed) {
          setStatus({ phase: 'error', freq, message: 'bad signal' });
          return null;
        }
        const { channelName, subtitle, imagePrompt } = parsed;
        setStatus({ phase: 'image', freq, subtitle, channelName });
        const imageUrl = await genImageWithRetry(
          genImg,
          { prompt: buildImagePrompt(imagePrompt) },
          (info) => {
            if (inFlightRef.current !== freq) return;
            if (info.retrying) {
              setStatus({ phase: 'image', freq, subtitle, channelName, secondsLeft: info.secondsLeft });
            } else {
              setStatus({ phase: 'image', freq, subtitle, channelName });
            }
          },
        );
        if (inFlightRef.current !== freq) return null;
        const channel: Channel = { freq, channelName, subtitle, imageUrl };
        setStatus({ phase: 'idle' });
        return channel;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (inFlightRef.current === freq) {
          setStatus({ phase: 'error', freq, message: msg });
        }
        return null;
      } finally {
        if (inFlightRef.current === freq) inFlightRef.current = null;
      }
    },
    [chat, genImg],
  );

  return { fetchChannel, status };
}
