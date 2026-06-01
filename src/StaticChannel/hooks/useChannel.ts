// One LLM call → channelName+subtitle+imagePrompt JSON, then gen-image in
// parallel-ish (gen-image is the slow one, ~30-60s; chat is ~2s).
//
// Two flows:
//   fetchChannel(freq)        — first ever signal on a freq (full call sign + scene)
//   extendChannel({...})      — continue an existing broadcast on the same freq

import { useCallback, useRef, useState } from 'react';
import { useChat, useGenImage } from '@shared/runtime';
import { genImageWithRetry } from '../utils/genImageWithRetry';
import {
  CHANNEL_CHAT_SYSTEM,
  CHANNEL_EXTEND_SYSTEM,
  buildImagePrompt,
  parseChannelJSON,
  parseExtendJSON,
  userPromptForExtend,
  userPromptForFreq,
} from '../utils/prompts';
import type { Channel, Segment } from '../types';
import { snapFreq } from '../types';

export type ChannelGenStatus =
  | { phase: 'idle' }
  | { phase: 'meta'; freq: number }
  | { phase: 'image'; freq: number; subtitle: string; channelName: string; secondsLeft?: number }
  | { phase: 'extending'; freq: number; channelName: string; secondsLeft?: number }
  | { phase: 'error'; freq: number; message: string };

export function useChannel() {
  // Fresh chat per call so we don't carry history across frequencies.
  const chat = useChat({ system: CHANNEL_CHAT_SYSTEM, maxHistory: 0 });
  const extendChat = useChat({ system: CHANNEL_EXTEND_SYSTEM, maxHistory: 0 });
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

  const extendChannel = useCallback(
    async (args: { freq: number; channelName: string; priorSubtitle: string; nudge?: string }): Promise<Segment | null> => {
      const freq = snapFreq(args.freq);
      if (inFlightRef.current === freq) return null;
      inFlightRef.current = freq;
      setStatus({ phase: 'extending', freq, channelName: args.channelName });
      try {
        const reply = await extendChat.send(
          userPromptForExtend({ freq, channelName: args.channelName, priorSubtitle: args.priorSubtitle, nudge: args.nudge }),
        );
        if (inFlightRef.current !== freq) return null;
        const parsed = parseExtendJSON(reply);
        if (!parsed) {
          setStatus({ phase: 'error', freq, message: 'bad signal' });
          return null;
        }
        const { subtitle, imagePrompt } = parsed;
        const imageUrl = await genImageWithRetry(
          genImg,
          { prompt: buildImagePrompt(imagePrompt) },
          (info) => {
            if (inFlightRef.current !== freq) return;
            if (info.retrying) {
              setStatus({ phase: 'extending', freq, channelName: args.channelName, secondsLeft: info.secondsLeft });
            } else {
              setStatus({ phase: 'extending', freq, channelName: args.channelName });
            }
          },
        );
        if (inFlightRef.current !== freq) return null;
        const seg: Segment = {
          freq,
          channelName: args.channelName,
          subtitle,
          imageUrl,
          ts: Date.now(),
        };
        setStatus({ phase: 'idle' });
        return seg;
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
    [extendChat, genImg],
  );

  return { fetchChannel, extendChannel, status };
}
