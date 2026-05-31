// Frequency tape under the TV — a horizontal strip of FM markings with a
// fixed indicator at center. Visual only; the actual tuning input lives on
// the TV screen.

import './Dial.less';
import { FREQ_MAX, FREQ_MIN } from '../types';

const TAPE_PX_PER_MHZ = 36;
const TAPE_TOTAL_PX = (FREQ_MAX - FREQ_MIN) * TAPE_PX_PER_MHZ;

export default function Dial({ freq }: { freq: number }) {
  const offset = -((freq - FREQ_MIN) * TAPE_PX_PER_MHZ);
  return (
    <div className="sc-dial">
      <div className="sc-dial__viewport">
        <div
          className="sc-dial__tape"
          style={{ width: `${TAPE_TOTAL_PX}px`, transform: `translateX(calc(50% + ${offset}px))` }}
        >
          {Array.from({ length: Math.round((FREQ_MAX - FREQ_MIN) * 10) + 1 }, (_, i) => {
            const f = FREQ_MIN + i * 0.1;
            const isMajor = Math.round(f) === f;
            const isHalf = !isMajor && Math.abs(f - Math.round(f)) < 0.05;
            return (
              <div
                key={i}
                className={`sc-dial__tick ${isMajor ? 'sc-dial__tick--major' : isHalf ? 'sc-dial__tick--half' : ''}`}
                style={{ left: `${i * (TAPE_PX_PER_MHZ / 10)}px` }}
              >
                {isMajor && <span className="sc-dial__num">{f.toFixed(0)}</span>}
              </div>
            );
          })}
        </div>
        <div className="sc-dial__pointer" aria-hidden="true" />
        <div className="sc-dial__shroud sc-dial__shroud--left" />
        <div className="sc-dial__shroud sc-dial__shroud--right" />
      </div>
    </div>
  );
}
