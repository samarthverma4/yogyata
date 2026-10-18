import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { STAKEHOLDERS, type Stakeholder, type StakeholderId } from '../data/stakeholders';
import { useMediaQuery } from '../hooks/useMediaQuery';

export function RolePicker() {
  const [active, setActive] = useState<StakeholderId | null>(null);
  const hovered = useRef<StakeholderId | null>(null);
  const canHover = useMediaQuery('(hover: hover)');
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="roles">
      <div className="wrap">
        <h1>Click to choose your role</h1>
        <ul className={active ? 'people has-active' : 'people'}>
          {STAKEHOLDERS.map((s) => (
            <Person
              key={s.id}
              stakeholder={s}
              on={active === s.id}
              onEnter={() => {
                hovered.current = s.id;
                if (canHover) setActive(s.id);
              }}
              onLeave={() => {
                hovered.current = null;
                if (canHover) setActive((cur) => (cur === s.id ? null : cur));
              }}
              onFocus={() => setActive(s.id)}
              onBlur={() => {
                if (hovered.current !== s.id) setActive((cur) => (cur === s.id ? null : cur));
              }}
              onChoose={() => navigate(`/auth/${s.id}?mode=signup`)}
            />
          ))}
        </ul>
      </div>
    </main>
  );
}

interface PersonProps {
  stakeholder: Stakeholder;
  on: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onChoose: () => void;
}

function Person({ stakeholder: s, on, onEnter, onLeave, onFocus, onBlur, onChoose }: PersonProps) {
  const cardId = `card-${s.id}`;
  const style = { '--w': s.artWidth } as CSSProperties;

  return (
    <li className={on ? 'person on' : 'person'} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        className="figure"
        type="button"
        aria-describedby={cardId}
        aria-label={`Continue as ${s.name}`}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={onChoose}
      >
        <img src={s.art} alt="" />
        <span className="name">{s.name}</span>
      </button>
      <div className="card" id={cardId} role="note">
        <p className="who">{s.group}</p>
        <h2>{s.name}</h2>
        <p className="does">{s.does}</p>
        <p className="gets-label">What they get</p>
        <ul>
          {s.gets.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p className="go">Click to continue as {s.name} →</p>
      </div>
    </li>
  );
}
