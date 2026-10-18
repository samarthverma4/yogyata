import { Link } from 'react-router-dom';
import iconMark from '../brand/icon-mark.svg';
import wordmark from '../brand/wordmark.png';
import type { CSSProperties } from 'react';

// The wordmark PNG is used as a mask so its colour comes from --brand.
const wordmarkStyle = { '--logo': `url("${wordmark}")` } as CSSProperties;

export function Header({ compact = false }: { compact?: boolean }) {
  return (
    <header className={compact ? 'top compact' : 'top'}>
      <Link className="mark-tl" to="/" aria-label="Yogyata home">
        <img src={iconMark} alt="" width={52} height={52} />
      </Link>
      <div className="wrap">
        <Link className="logo" to="/" role="img" aria-label="योग्यता (Yogyata)" style={wordmarkStyle} />
      </div>
    </header>
  );
}
