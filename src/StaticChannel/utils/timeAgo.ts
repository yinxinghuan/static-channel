// Compact relative time formatter. Falls back to i18n strings for unit labels
// so zh / en stay consistent with the rest of the game.

import { t } from '../i18n';

export function timeAgo(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 30)  return t('ago.now');
  if (sec < 60)  return t('ago.sec', { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60)  return t('ago.min', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24)   return t('ago.hr', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7)   return t('ago.day', { n: day });
  const wk = Math.floor(day / 7);
  if (wk < 4)    return t('ago.wk', { n: wk });
  const mo = Math.floor(day / 30);
  return t('ago.mo', { n: mo });
}
