// "Tonight's signals" wall — paginated single column of channel cards from
// other users + a "kept" tab for the player's own collection. Tapping a card
// closes the wall and jumps the TV to that frequency.

import { useState } from 'react';
import './Wall.less';
import type { SavedChannel, WallEntry } from '../types';
import { t } from '../i18n';
import { openAigramProfile, isInAigram } from '@shared/runtime';

type Tab = 'wall' | 'mine';

export type WallProps = {
  open: boolean;
  onClose: () => void;
  onJump: (freq: number) => void;
  entries: WallEntry[];
  mine: SavedChannel[];
};

export default function Wall({ open, onClose, onJump, entries, mine }: WallProps) {
  const [tab, setTab] = useState<Tab>('wall');
  if (!open) return null;

  const showWall = tab === 'wall';
  const list = showWall ? entries : mine;

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
          {t('wall.tab_mine')} {mine.length ? `· ${mine.length}` : ''}
        </button>
        <button className="sc-wall__close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>

      <div className="sc-wall__scroll">
        {list.length === 0 ? (
          <div className="sc-wall__empty">
            {showWall ? t('wall.empty_wall') : t('wall.empty_mine')}
          </div>
        ) : (
          list.map((row, i) => {
            const wallRow = row as WallEntry;
            const author = showWall ? wallRow : null;
            return (
              <button
                key={`${row.freq}-${row.ts ?? i}`}
                className="sc-wall__card"
                onClick={() => {
                  onJump(row.freq);
                  onClose();
                }}
              >
                <div className="sc-wall__pic-wrap">
                  <img className="sc-wall__pic" src={row.imageUrl} alt="" draggable={false} />
                  <div className="sc-wall__pic-scan" />
                  <div className="sc-wall__pic-vign" />
                  <span className="sc-wall__freq">{row.freq.toFixed(1)}</span>
                </div>
                <div className="sc-wall__meta">
                  <div className="sc-wall__top">
                    <span className="sc-wall__call">{row.channelName}</span>
                    {author && (
                      <span
                        className="sc-wall__author"
                        role="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (isInAigram) openAigramProfile(author.userId);
                        }}
                      >
                        {author.userAvatarUrl ? (
                          <img className="sc-wall__avatar" src={author.userAvatarUrl} alt="" draggable={false} />
                        ) : (
                          <span className="sc-wall__avatar sc-wall__avatar--letter">
                            {(author.userName || '?').slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="sc-wall__name">{author.userName}</span>
                      </span>
                    )}
                    {!author && (
                      <span className="sc-wall__author sc-wall__author--you">{t('wall.you')}</span>
                    )}
                  </div>
                  <div className="sc-wall__sub">{row.subtitle}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
