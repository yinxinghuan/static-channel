export type Channel = {
  freq: number;          // e.g. 91.7 — primary key, 0.1 MHz step
  channelName: string;   // 'WGRT-7'
  subtitle: string;      // 'a wedding from 1987, nobody is dancing yet'
  imageUrl: string;
};

export type SavedChannel = Channel & {
  ts: number;            // epoch ms when kept
};

export type WallEntry = SavedChannel & {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
};

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
