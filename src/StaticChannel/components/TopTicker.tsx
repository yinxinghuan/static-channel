// One-line activity stripe above the TV. Shows the single latest cross-user
// segment ("Bob added to 92.7 · steam from a kettle…"). Tap → opens wall.
// Right side: pulsing pill when the user has unseen segments on their bookmarks.
//
// Deliberately not auto-rotating — auto-rotating a tappable surface races
// the user's gesture. Single latest only.

import './TopTicker.less';
import type { SegmentWithAuthor } from '../types';
import { t } from '../i18n';

export type TopTickerProps = {
  latest?: SegmentWithAuthor;
  unseen: number;
  onOpen: () => void;
};

export default function TopTicker({ latest, unseen, onOpen }: TopTickerProps) {
  return (
    <button className="sc-ticker" onClick={onOpen} aria-label={t('ticker.open_wall')}>
      <span className="sc-ticker__dot" aria-hidden="true">◉</span>
      <span className="sc-ticker__body">
        {latest ? (
          <>
            {latest.authorAvatarUrl ? (
              <img className="sc-ticker__avatar" src={latest.authorAvatarUrl} alt="" draggable={false} />
            ) : (
              <span className="sc-ticker__avatar sc-ticker__avatar--letter">
                {(latest.authorName || '?').slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="sc-ticker__name">{latest.authorName}</span>
            <span className="sc-ticker__sep">·</span>
            <span className="sc-ticker__verb">{t('ticker.added', { f: latest.freq.toFixed(1) })}</span>
            <span className="sc-ticker__sep">·</span>
            <span className="sc-ticker__sub">{latest.subtitle}</span>
          </>
        ) : (
          <span className="sc-ticker__sub sc-ticker__sub--empty">{t('ticker.empty')}</span>
        )}
      </span>
      {unseen > 0 && (
        <span className="sc-ticker__pill" aria-label={t('ticker.new_pill', { n: unseen })}>
          {t('ticker.new_pill', { n: unseen })}
        </span>
      )}
    </button>
  );
}
