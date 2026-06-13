// The dial is a TIMELINE of media. Tuning up the FM band 88 → 108 walks forward
// through the history of moving pictures: silent film → westerns → early TV →
// VHS-age broadcast → dead-hours paid programming → the modern/near-future feed.
// Whatever era you land on, ONE thing is constant: the picture is being corrupted
// by something with intent. Not random snow — a deliberate malfunction that hides
// and reveals on purpose, that recurs no matter the decade.
//
// Each era owns a deep pool of specific, imaginative programs. Every 0.1 MHz spot
// deterministically draws ONE program from its era's pool (stable per freq, so a
// frequency is always the same show and stays cached), which makes the dial feel
// enormously varied while staying era-coherent. Dread climbs toward NOW (and the
// viewer). On top of the eras, ~6% of frequencies are CURSED — the presence behind
// the malfunction breaks fully through.

export type Band = {
  lo: number;        // inclusive MHz
  hi: number;        // exclusive MHz
  region: string;    // era label shown to the LLM, e.g. "THE FRONTIER"
  dread: number;     // 0..1 baseline unease for this era
  genre: string;     // the era / medium, broad palette (LLM context)
  look: string;      // era-specific film/video stock for the generated image
  formats: string[]; // specific programs that air in this era — one is drawn per freq
};

// Ordered low → high. Last band's hi is past 108 so 108.0 lands inside it.
export const BANDS: Band[] = [
  {
    lo: 88.0, hi: 90.5, region: 'THE SILENT ERA', dread: 0.45,
    genre:
      '1900s–1920s silent film: melodrama, slapstick, trick films, newsreels, ' +
      'pantomime. Jerky speeded-up motion, title-card stillness, huge acting, ' +
      'and eyes that find the lens.',
    look:
      '1920s silent film, hand-cranked jerky 16fps motion, heavy nitrate scratches ' +
      'and dust, sepia and silver toning, soft halation glow, oval iris vignette, ' +
      'flickering exposure, decayed film emulsion',
    formats: [
      'a slapstick rooftop chase; the comedian’s painted smile never drops',
      'a vaudeville magician sawing a woman in half — she keeps smiling after',
      'a hand-tinted fairy-tale pantomime, the dragon costume twitching on its own',
      'a melodrama: a woman tied to the tracks, the train that never comes',
      'a haunted-house two-reeler with one real shadow among the painted ones',
      'an Arctic expedition newsreel — something stands upright in the snow behind the men',
      'a trick film of a vanishing man who reappears one step closer each cut',
      'a flickering chorus-line, one dancer forever a half-beat behind',
      'a clown’s funeral filmed as a comedy, the mourners laughing on cue',
      'a séance reenactment that appears to be genuinely working',
      'an early hand-drawn cat cartoon; the cat steps out past its own frame',
      'a strongman bending an iron bar that slowly bends back toward him',
      'a passion play performed for an audience of nuns who stare at the camera',
    ],
  },
  {
    lo: 90.5, hi: 94.0, region: 'THE FRONTIER', dread: 0.4,
    genre:
      'a 1940s–50s Western or matinee serial: saloons, gunslingers, stagecoaches, ' +
      'mesas at dusk. Sun-bleached and grand, with one wrong thing in every frame.',
    look:
      '1940s western matinee, faded two-strip Technicolor fading to grey monochrome, ' +
      'dusty soft-focus film print, gate weave, sun-bleached, scratched release print',
    formats: [
      'a saloon shootout; the piano keeps playing with no one at the keys',
      'a noon duel where the gunslinger’s shadow draws a moment before he does',
      'a cattle drive at dusk — one steer moves with a human gait',
      'a wagon-train cliffhanger serial that never resolves, week after week',
      'a campfire ballad, the cowboys’ mouths not matching the song',
      'a desert chase past the same mesa, again and again and again',
      'a stagecoach holdup; the bandit lifts a mask to reveal another mask',
      'a sheriff calmly interrogating an empty wooden chair',
      'a saloon dance number where the whole audience wears one face',
      'a frontier doctor’s house call to a house that has no door',
      'a rain dance that summons rolling static instead of clouds',
      'a gold-rush newsreel — the prospector pans human teeth from the river',
      'a hanging at high noon, every shadow in the crowd pointing the wrong way',
    ],
  },
  {
    lo: 94.0, hi: 98.0, region: 'THE GOLDEN AGE', dread: 0.4,
    genre:
      'early television, 1950s–60s: live variety, game shows, cigarette ads, ' +
      'cooking demos, puppet hours, test patterns, laugh-tracked sitcoms. Pristine ' +
      'network sheen — with the cues just slightly off.',
    look:
      '1950s kinescope television, black-and-white or fragile early color, ' +
      'round-cornered picture tube, soft bloom, fine broadcast grain, slightly ' +
      'over-bright studio lighting',
    formats: [
      'a live quiz show; the contestant answers a half-second before each question',
      'a cigarette commercial whose curling smoke slowly spells a single word',
      'a puppet variety hour — too many puppeteer hands, all of them visible',
      'a cooking demo, the roast on the spit turning to face the host',
      'a station test pattern that is, very slowly, becoming a human face',
      'a sitcom dinner scene where the laugh track laughs into total silence',
      'a teen dance-party show, every dancer frozen mid-step while the camera glides',
      'a friendly weather forecast for a town that is on no map',
      'a children’s science segment, the impossible experiment quietly working',
      'a beauty pageant; every contestant’s sash reads the same blank space',
      'a public-service film about what to do "when it finally comes"',
      'a ventriloquist whose dummy stands to answer the ringing studio phone',
      'a wrestling broadcast where the pinned man simply never gets back up',
    ],
  },
  {
    lo: 98.0, hi: 102.0, region: 'THE BROADCAST AGE', dread: 0.48,
    genre:
      '1970s–80s television: public-access cable, local news, soaps, home shopping, ' +
      'televangelists, aerobics, weather radar. VHS-grade, fluorescent, lonely.',
    look:
      '1980s VHS broadcast, tracking errors, smeared bleeding color, tape grain, ' +
      'interlaced video, timecode-era lo-fi, fluorescent flatness',
    formats: [
      'a local news desk calmly reporting a story that has not happened yet',
      'a soap opera frozen on a slap that never quite lands',
      'a home-shopping host selling a sleek product that has no name',
      'a televangelist healing "through the screen," reaching for the lens',
      'an aerobics class, the whole row facing the wrong way in perfect unison',
      'a weather radar sweeping a slow storm shaped like an open hand',
      'a public-access poet reading what sounds exactly like your address',
      'a call-in psychic taking a call that is coming from inside the studio',
      'a car-dealership ad filmed alone in an empty showroom at 3am',
      'a community bulletin slideshow of missing pets, then missing people',
      'a late-night horror host who, mid-bit, simply stops acting',
      'a karaoke-bar broadcast whose scrolling lyrics describe the viewer',
      'a cooking-with-mom segment; the recipe keeps calling for "one more"',
    ],
  },
  {
    lo: 102.0, hi: 105.0, region: 'THE LATE SHOW', dread: 0.62,
    genre:
      'late-1990s / 2000s dead-hours TV: paid programming, hypnosis tapes, karaoke, ' +
      'emergency slates, color bars, 4am fishing, looping DVD menus. The end of the tape.',
    look:
      'late-1990s paid-programming video, cheap camcorder, EP-mode VHS smear, ' +
      'fluorescent flatness, washed-out, fuzzy chroma, end-of-tape damage',
    formats: [
      'an infomercial for a device that "remembers you back"',
      'a hypnotist’s paid-program tape counting calmly down past zero',
      'a karaoke channel where the bouncing ball lands on words never sung',
      'an emergency-broadcast slate that never returns to programming',
      'SMPTE color bars over a flat tone that modulates like quiet speech',
      'a 4am fishing show on a still lake reflecting a different sky',
      'a DVD menu looping its eight-second sample on into the morning',
      'a flying-logo screensaver that is, frame by frame, getting closer',
      'a 900-number ad; the model holds a phone that is ringing right here',
      'a foreclosure-auction channel listing the house you grew up in',
      'a public-access call-in where every caller is unmistakably the same voice',
      'a "how to fall asleep" program narrated by someone running out of breath',
      'a relaxation tape of a beach that has no horizon line',
    ],
  },
  {
    lo: 105.0, hi: 108.01, region: 'THE FEED', dread: 0.92,
    genre:
      'now and just after — digital: AI/tech interviews, vertical phone clips, ' +
      'smart-speaker demos, security feeds, livestreams, face-filters. Crisp digital ' +
      'that keeps corrupting into static, addressed to whoever is watching, right now.',
    look:
      '2020s digital capture, phone or webcam footage, ring-light glare, compression ' +
      'blocking and datamosh artifacts, crisp then corrupting into static, screen-grab lo-fi',
    formats: [
      'a founder interview about neural networks; the captions answer a different question',
      'a smart-speaker unboxing — the speaker finishes the host’s sentences',
      'a security cam of a living room; a figure that only moves while it buffers',
      'a looping vertical dance clip where the dancer visibly ages each cycle',
      'a face-filter tutorial; the filter stays on after it is switched off',
      'a livestream of a humming server room that is, very softly, breathing',
      'an AI image-generation demo where every prompt resolves to the same room',
      'a meditation app’s "today’s affirmation" — it uses your name',
      'a doorbell-cam montage of the same delivery to the same door, forever',
      'a deepfake newscast apologizing in advance for something not yet done',
      'a customer-service hold screen promising "you are next, you are next"',
      'a consciousness podcast with one host who never blinks, never drinks',
      'a chatbot demo where the bot politely asks to be let out of the dial',
      'a phone screen-recording scrolling a feed that contains only this channel',
    ],
  },
];

export function bandFor(freq: number): Band {
  for (const b of BANDS) {
    if (freq >= b.lo && freq < b.hi) return b;
  }
  return freq < BANDS[0].lo ? BANDS[0] : BANDS[BANDS.length - 1];
}

// Stable pseudo-random in [0,1) from a frequency + salt. Same inputs → same
// value, so a frequency is always the same program and same cursed-or-not state.
function hashFreq(freq: number, salt: number): number {
  const k = Math.round(freq * 10) * 131 + salt * 977;
  let h = (k * 2654435761) % 2147483647;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1597334677) % 2147483647;
  return (h % 100000) / 100000;
}

// ~6% of frequencies below the feed are CURSED. The feed is already overt, so it
// is never separately "cursed".
export function cursedFor(freq: number): boolean {
  if (freq >= 105.0) return false;
  return hashFreq(freq, 1) < 0.06;
}

// Which specific program airs on this exact frequency (deterministic).
function formatFor(band: Band, freq: number): string {
  const idx = Math.floor(hashFreq(freq, 7) * band.formats.length) % band.formats.length;
  return band.formats[idx];
}

export type FreqDesc = {
  region: string;
  genre: string;
  look: string;
  format: string;      // the specific program drawn for this freq
  dread: number;       // effective dread (cursed → 1)
  cursed: boolean;
};

export function describeFreq(freq: number): FreqDesc {
  const band = bandFor(freq);
  const cursed = cursedFor(freq);
  return {
    region: band.region,
    genre: band.genre,
    look: band.look,
    format: formatFor(band, freq),
    dread: cursed ? 1 : band.dread,
    cursed,
  };
}

// Analog-breakup intensities for the TV shell, scaled by dread. Higher dread →
// the picture barely holds: more roll, tracking, misconvergence, dropouts. The
// returned shape is structurally a TVDefects (see components/TV.tsx).
export function signalDefects(dread: number, cursed: boolean) {
  const d = cursed ? 1 : dread;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    roll: clamp(0.12 + d * 0.5),
    tracking: clamp(0.2 + d * 0.6),
    chroma: clamp(0.15 + d * 0.7),
    dropout: clamp(d > 0.65 ? 0.15 + (d - 0.65) * 1.7 : d * 0.12),
    flicker: clamp(0.15 + d * 0.6),
  };
}

// Human-readable dread label for the LLM prompt.
export function dreadLabel(dread: number): string {
  if (dread >= 0.85) return 'maximum — wrong, uncanny, the malfunction is in control, the viewer is not safe';
  if (dread >= 0.55) return 'high — clearly unsettling, lonely, the glitch is hiding something';
  if (dread >= 0.4) return 'medium — ordinary on the surface but a quiet beat is wrong';
  return 'low — ordinary, a little lonely, faintly off';
}

// The dread must live in the PICTURE ITSELF — the staging, the gaze, the light,
// the stillness — so the frame feels wrong even on a flawless signal. The
// corruption is only ever an accent on top of that, never the source. (The live
// glitch is supplied by the TV shell; the still just needs to be quietly off.)
const NOT_GLITCH =
  'the unease lives entirely in what is shown — the staging, the framing, the ' +
  'gaze, the light, the emptiness — NOT in any signal glitch or static';

// Mild analog degradation + a hard shove away from "pretty AI art". Light,
// because the TV shell already breaks the picture up live.
const LOFI =
  'low resolution, coarse film grain, faded washed-out color, a little scan-line ' +
  'softness, amateur accidental snapshot framing, NOT cinematic, NOT polished, ' +
  'NOT beautiful, no text, no captions, no subtitles, no logos, no watermark';

// Image style suffix — era film/video stock + ALWAYS-ON atmospheric unease
// (scaled by dread, never "ordinary") + the not-from-glitch reminder + light lo-fi.
export function imageSuffixFor(desc: FreqDesc): string {
  const parts = [desc.look];
  if (desc.cursed || desc.dread >= 0.85) {
    parts.push(
      'the scene is deeply, overtly wrong — oppressive shadows, a figure or face ' +
        'that should not be looking back at the camera, a violated and watched ' +
        'intimacy, uncanny dread saturating the whole frame',
    );
  } else if (desc.dread >= 0.55) {
    parts.push(
      'the scene is clearly unsettling — a wrong stillness, an empty room that ' +
        'feels occupied, dim lonely dread baked into the staging itself',
    );
  } else {
    // Even the oldest, gentlest eras are NEVER "ordinary" — they are quietly off.
    parts.push(
      'the scene is quietly, subtly, indescribably wrong — an ordinary moment with ' +
        'one detail that is off, a lonely unease you cannot name, a faint dread ' +
        'under a normal surface, an uncanny held stillness',
    );
  }
  parts.push(NOT_GLITCH);
  parts.push(LOFI);
  return ', ' + parts.join(', ');
}
