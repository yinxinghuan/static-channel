// One LLM call per never-seen frequency. The dial has geography (see bands.ts):
// each call is told which REGION it landed in, that region's GENRE, and a DREAD
// level, and must commit hard to that register. Returns JSON with:
//   channelName: short call sign (e.g. WGRT-7, K88-NORTH)
//   subtitle: a single concrete, present-tense "now playing" line
//   imagePrompt: scene-only description, no people-types, no quotes
//
// Image style suffix (dread-scaled, in bands.ts) is appended client-side →
// degraded, ugly, menacing analog still.

import { dreadLabel, imageSuffixFor, type FreqDesc } from './bands';

export const CHANNEL_CHAT_SYSTEM = `You are the signal a single old TV pulls in as someone tunes it through the whole history of broadcasting.
The dial is a timeline: low frequencies are the oldest media (silent film), high frequencies are the present and just beyond (the digital feed).
You are given ONE frequency, the ERA it sits in, the specific PROGRAM airing there, and a DREAD level.
You broadcast back that ONE program — vivid, specific, and unmistakably of its era and medium.

THE ONE CONSTANT across every era: the picture is being corrupted by something with INTENT. Not random static —
a deliberate malfunction that hides things and reveals them on purpose. The same wrongness recurs no matter the decade.
It is patient. It is paying attention. The glitch is the antagonist.

Reply with ONLY a single-line minified JSON object. No prose, no markdown.

Schema:
{ "channelName": string, "subtitle": string, "imagePrompt": string }

- channelName: 3–10 char broadcast call sign in caps, often with a hyphen or number.
  Examples: "WGRT-7", "K88-NORTH", "CH-LATE", "ZONE-9", "KINE-2", "FEED-9".
- subtitle: ONE chyron line, 4–14 words, plain text. No emojis. No quotes.
  CONCRETE and SPECIFIC — one vivid detail or wrong thing happening RIGHT NOW, true to the era and the program.
  Use a present-tense verb. NEVER abstract nouns ("a memory", "silence", "loss", "restraint").
  A stranger must read it in 2 seconds and instantly feel something.
  Good: "the magician saws her in half; she keeps smiling after" /
        "the founder answers a question the host never asked" /
        "the piano keeps playing with no one at the keys" /
        "the test pattern is, very slowly, becoming a face".
  Bad: "a sense of unease" / "the weight of time" / "something lost".
- imagePrompt: SCENE only, 12–25 words, true to the ERA and MEDIUM (film stock, sets, costumes, technology of that decade).
  The scene MUST feel quietly, indescribably WRONG even on a perfect signal — put the dread in the staging,
  the framing, the gaze, the light, the stillness, the emptiness. Do NOT rely on glitches, static, or corruption
  for the unease; the picture itself should be uncanny. Compose one off detail into the frame.
  Do NOT name famous people. Do NOT use first person. Just describe what the camera sees.

Match the DREAD exactly. Low = an ordinary scene with a quiet wrongness (never just "ordinary"). High = clearly
unsettling. Maximum = the malfunction is in control. Never gore — the horror is the ordinary held a beat too long,
or a familiar thing that should not be looking back at you.`;

export function buildImagePrompt(scene: string, desc: FreqDesc): string {
  return scene.trim().replace(/[.。]+$/, '') + imageSuffixFor(desc);
}

export function userPromptForFreq(freq: number, desc: FreqDesc): string {
  const lines = [
    `Frequency: ${freq.toFixed(1)} MHz.`,
    `Era: ${desc.region}.`,
    `Era palette: ${desc.genre}`,
    `Program airing on this exact frequency: ${desc.format}.`,
    `Dread: ${desc.dread.toFixed(2)} (${dreadLabel(desc.dread)}).`,
  ];
  if (desc.cursed) {
    lines.push(
      'OVERRIDE: this frequency is CURSED — the presence behind the malfunction breaks fully through this program. ' +
        'It is AWARE of the person watching: it addresses them, waits for them, or knows something it should not. ' +
        'Stay inside the era and program above, but make it intimate, personal, and inescapable. One concrete wrong detail.',
    );
  }
  lines.push('Broadcast this exact program. Commit hard to its era and medium — make it distinct and vivid.');
  return lines.join('\n');
}

// ─── Stay On Air: continue an existing broadcast ──────────────────────────
// Caller supplies the channelName, the most recent subtitle, the freq's region,
// and an optional one-line nudge from the player ("go weirder", etc.).

export const CHANNEL_EXTEND_SYSTEM = `You are the signal a late-night TV pulls in.
You are continuing an EXISTING broadcast at the same frequency, on the same channel.
The channel name STAYS the same — do not invent a new one.
The new subtitle is what plays NEXT on that channel, after the prior segment.
It must feel like the SAME station, the SAME night, the SAME region of the dial — just a
later moment in the broadcast. A new caller, a different segment of the show, a cut to
b-roll, the host coming back from a break — pick whatever fits, but stay in the same dread.

Reply with ONLY a single-line minified JSON object. No prose.

Schema:
{ "subtitle": string, "imagePrompt": string }

- subtitle: ONE concrete present-tense line, 4–14 words. No emojis. No quotes. No abstract nouns.
  Refer back to the world implied by the prior subtitle, but ADVANCE it — something new happens.
- imagePrompt: SCENE description, 12–25 words, no famous people, no first person.`;

export function userPromptForExtend(args: {
  freq: number;
  channelName: string;
  priorSubtitle: string;
  desc: FreqDesc;
  nudge?: string;
}): string {
  const lines = [
    `Frequency: ${args.freq.toFixed(1)} MHz.`,
    `Era: ${args.desc.region}.`,
    `Era palette: ${args.desc.genre}`,
    `This channel's program: ${args.desc.format}.`,
    `Dread: ${args.desc.dread.toFixed(2)} (${dreadLabel(args.desc.dread)}).`,
    `Channel: ${args.channelName}.`,
    `Prior segment subtitle: ${args.priorSubtitle}`,
  ];
  if (args.desc.cursed) {
    lines.push('This frequency is CURSED — the malfunction is aware of the viewer. Keep it intimate and wrong.');
  }
  if (args.nudge && args.nudge.trim()) {
    lines.push(`Caller-in nudge for what plays next: ${args.nudge.trim().slice(0, 120)}`);
  }
  lines.push('Broadcast the next segment of this same channel.');
  return lines.join('\n');
}

export function parseExtendJSON(raw: string): { subtitle: string; imagePrompt: string } | null {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof obj.subtitle !== 'string' || typeof obj.imagePrompt !== 'string') return null;
    return {
      subtitle: obj.subtitle.slice(0, 140),
      imagePrompt: obj.imagePrompt.slice(0, 400),
    };
  } catch (_) {
    return null;
  }
}

// Robust parse — model occasionally wraps in code fences or trailing prose.
export function parseChannelJSON(raw: string): { channelName: string; subtitle: string; imagePrompt: string } | null {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof obj.channelName !== 'string' || typeof obj.subtitle !== 'string' || typeof obj.imagePrompt !== 'string') return null;
    return {
      channelName: obj.channelName.slice(0, 16),
      subtitle: obj.subtitle.slice(0, 140),
      imagePrompt: obj.imagePrompt.slice(0, 400),
    };
  } catch (_) {
    return null;
  }
}
