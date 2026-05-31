// One LLM call per never-seen frequency. Returns JSON with:
//   channelName: short call sign (e.g. WGRT-7, K88-NORTH)
//   subtitle: a single weird, evocative "now playing" line
//   imagePrompt: scene-only description, no people-types, no quotes
//
// Style suffix appended to imagePrompt → analog CRT VHS still

export const CHANNEL_CHAT_SYSTEM = `You are the signal pulled in by a late-night TV being tuned across the FM band.
You receive ONE frequency (in MHz, e.g. 91.7) and you broadcast back ONE channel.

You must reply with ONLY a single-line minified JSON object. No prose, no markdown.

Schema:
{ "channelName": string, "subtitle": string, "imagePrompt": string }

- channelName: 3–10 char broadcast call sign in caps, often with hyphen or number.
  Examples: "WGRT-7", "K88-NORTH", "CH-LATE", "ZONE-9".
- subtitle: ONE evocative line, 4–14 words, plain text. No emojis. No quotes.
  This is what a chyron caption would say. Specific over abstract.
  Examples: "your mom is rolling dumplings, kitchen radio on, 1994" /
            "a wedding from 1987, nobody is dancing yet" /
            "test pattern for a town that no longer exists" /
            "the dog show, fifth hour, judges look tired".
- imagePrompt: SCENE description for a vintage CRT still.
  Describe ONLY the scene, atmosphere, lighting, framing. Do NOT name famous people.
  Do NOT use first-person. Keep it 12–25 words.
  Examples: "an empty 1980s kitchen at night, fluorescent light, linoleum floor, kettle on the stove, soft shadows" /
            "wedding reception interior, paper streamers, folding chairs, low warm tungsten light, nobody on the dance floor".

Vibe palette across channels: mundane americana, soviet domesticity, late-night
public access, lost-tape footage, surveillance lobbies, children's programming
gone wrong, weather reports for nowhere, infomercials for things that don't exist,
school plays, recipe shows, fishing programs, religious broadcasts, test patterns,
home movies, security footage from an empty mall, ham radio on a snowy night.

Vary the vibe based on the frequency number — lower FM (88–93) skews wholesome /
educational / public-access; mid (93–101) skews commercial / lounge / cooking;
upper (101–108) skews late-night / weird / liminal. Do not state this rule;
just let it color the output.`;

export const IMAGE_STYLE_SUFFIX =
  ', shot on degraded VHS tape, scan lines, CRT phosphor glow, slight chromatic aberration, soft focus, 4:3 aspect, grainy, low resolution, washed faded colors, no text, no captions, no logos';

export function buildImagePrompt(scene: string): string {
  return scene.trim().replace(/[.。]+$/, '') + IMAGE_STYLE_SUFFIX;
}

export function userPromptForFreq(freq: number): string {
  return `Frequency: ${freq.toFixed(1)} MHz. Broadcast one channel.`;
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
