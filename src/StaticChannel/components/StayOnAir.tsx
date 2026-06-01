// Stay On Air composer — shown below the TV when there IS a signal locked in.
// Player types a one-line "what plays next" nudge (optional), taps Stay On Air,
// new segment is generated and appended to the broadcast.

import { useState } from 'react';
import './StayOnAir.less';
import { t } from '../i18n';

export type StayOnAirProps = {
  // null = no signal yet (composer is disabled with a hint)
  active: boolean;
  // a generation is in flight (composer locks)
  busy: boolean;
  onSend: (nudge: string) => void;
};

const MAX = 80;

export default function StayOnAir({ active, busy, onSend }: StayOnAirProps) {
  const [text, setText] = useState('');

  const send = () => {
    if (!active || busy) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className={`sc-stay ${active ? '' : 'is-disabled'} ${busy ? 'is-busy' : ''}`}>
      <input
        className="sc-stay__input"
        type="text"
        value={text}
        onChange={e => setText(e.target.value.slice(0, MAX))}
        onKeyDown={e => { if (e.key === 'Enter') send(); }}
        placeholder={active ? t('stay.placeholder') : t('stay.disabled_no_signal')}
        disabled={!active || busy}
        maxLength={MAX}
        aria-label={t('stay.placeholder')}
      />
      <button
        className="sc-stay__send"
        onClick={send}
        disabled={!active || busy}
        aria-label={t('stay.send')}
      >
        {busy ? t('stay.sending') : t('stay.send')}
      </button>
    </div>
  );
}
