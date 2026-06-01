// "Tonight's signals" wall — one row per frequency. Each row is a Broadcast
// (multi-segment thread). Tapping a card closes the wall and jumps the TV.

import { useState } from 'react';
import './Wall.less';
import type { Bookmark, Broadcast } from '../types';
import { sameFreq } from '../types';
import { t } from '../i18n';
import { openAigramProfile, isInAigram, telegramId } from '@shared/runtime';

type Tab = 'wall' | 'mine';

export type WallProps = {
  open: boolean;
  onClose: () => void;
  onJump: (freq: number) => void;
  broadcasts: Broadcast[];
  bookmarks: Bookmark[];
};

export default function Wall({ open, onClose, onJump, broadcasts, bookmarks }: WallProps) {
  const [tab, setTab] = useState<Tab>('wall');
  if (!open) return null;

  const myBookmarkSet = new Set(bookmarks.map(b => b.freq.toFixed(1)));
  const list = tab === 'wall'
    ? broadcasts
    : broadcasts.filter(b => myBookmarkSet.has(b.freq.toFixed(1)));

  return (
    <div className="sc-wall">
      <div className="sc-wall__bar">
        <button
          className={`sc-wall__tab ${tab === 'wall' ? 'is-active' : ''}`}
          onClick={() => setTab('wall')}
        >
          {t('wall.tab_wall')}
        </button>
        <button
          className={`sc-wall__tab ${tab === 'mine' ? 'is-active' : ''}`}
          onClick={() => setTab('mine')}
        >
          {t('wall.tab_mine')} {bookmarks.length ? `· ${bookmarks.length}` : ''}
        </button>
        <button className="sc-wall__close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>

      <div className="sc-wall__scroll">
        {list.length === 0 ? (
          <div className="sc-wall__empty">
            {tab === 'wall' ? t('wall.empty_wall') : t('wall.empty_mine')}
          </div>
        ) : (
          list.map((b) => {
            const bm = bookmarks.find(x => sameFreq(x.freq, b.freq));
            const hasNew = bm && b.segments.some(s => s.authorId !== telegramId && s.ts > bm.lastSeenTs);
            const latest = b.latest;
            const isSelfLatest = latest.authorId === telegramId;
            const segLabel = b.segmentCount === 1 ? t('segments.count_one') : t('segments.count', { n: b.segmentCount });
            return (
              <button
                key={b.freq.toFixed(1)}
                className={`sc-wall__card ${hasNew ? 'has-new' : ''}`}
                onClick={() => {
                  onJump(b.freq);
                  onClose();
                }}
              >
                <div className="sc-wall__pic-wrap">
                  <img className="sc-wall__pic" src={latest.imageUrl} alt="" draggable={false} />
                  <div className="sc-wall__pic-scan" />
                  <div className="sc-wall__pic-vign" />
                  <span className="sc-wall__freq">{b.freq.toFixed(1)}</span>
                  {b.segmentCount >= 2 && (
                    <span className="sc-wall__segpill" aria-label={segLabel}>•••{b.segmentCount}</span>
                  )}
                </div>
                <div className="sc-wall__meta">
                  <div className="sc-wall__top">
                    <span className="sc-wall__call">{b.channelName}</span>
                    {isSelfLatest ? (
                      <span className="sc-wall__author sc-wall__author--you">{t('wall.you')}</span>
                    ) : (
                      <span
                        className="sc-wall__author"
                        role="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (isInAigram) openAigramProfile(latest.authorId);
                        }}
                      >
                        {latest.authorAvatarUrl ? (
                          <img className="sc-wall__avatar" src={latest.authorAvatarUrl} alt="" draggable={false} />
                        ) : (
                          <span className="sc-wall__avatar sc-wall__avatar--letter">
                            {(latest.authorName || '?').slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="sc-wall__name">{latest.authorName}</span>
                      </span>
                    )}
                  </div>
                  <div className="sc-wall__sub">{latest.subtitle}</div>
                </div>
                {hasNew && <span className="sc-wall__newdot" aria-label="new" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
