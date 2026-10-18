import type { CSSProperties } from 'react';
import iconMark from './icon-mark.svg';
import wordmark from './wordmark.png';

const wordmarkStyle = { '--logo': `url("${wordmark}")` } as CSSProperties;

/** यो icon mark beside the योग्यता wordmark, with an optional small label underneath. */
export function BrandMark({ sub }: { sub?: string }) {
  return (
    <span className="yg-brand">
      <img className="yg-brand-icon" src={iconMark} alt="" width={34} height={34} />
      <span className="yg-brand-text">
        <span className="yg-brand-wordmark" role="img" aria-label="योग्यता (Yogyata)" style={wordmarkStyle} />
        {sub && <span className="yg-brand-sub">{sub}</span>}
      </span>
    </span>
  );
}
