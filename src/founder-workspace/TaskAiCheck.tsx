import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ai, AiError } from '../lib/aiClient';
import type { TaskCheck } from '../lib/aiClient';

interface Props {
  title: string;
  text: string;
  skills: string[];
  onAddSkill: (skill: string) => void;
}

/** Asks yogyata-ai whether a task is clear enough to post. Suggestions only; nothing is changed without a click. */
export function TaskAiCheck({ title, text, skills, onAddSkill }: Props) {
  const [result, setResult] = useState<TaskCheck | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try {
      setResult(await ai.taskCheck(title, text));
      setError('');
    } catch (e) {
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  }

  const have = new Set(skills.map((s) => s.toLowerCase()));
  const suggested = (result?.skills ?? []).filter((s) => !have.has(s.toLowerCase()));

  return (
    <div className="yw-form-group yg-feedback-block">
      <button type="button" className="ob-btn-secondary" onClick={check} disabled={busy || text.trim().length < 30}>
        <Sparkles size={15} aria-hidden="true" />
        <span>{busy ? 'Checking…' : 'Check with AI'}</span>
      </button>
      {error && <p className="yw-alert yw-alert-danger">{error}</p>}
      {result && (
        <div className="yg-stack" style={{ marginTop: 8 }}>
          <p className="yg-eyebrow">
            {result.warnings.length === 0 ? 'No problems found' : 'Could be clearer'}
            {result.difficulty ? ` · ${result.difficulty}` : ''}
            {result.estimated_hours ? ` · about ${result.estimated_hours} h` : ''}
          </p>
          {result.warnings.map((w) => (
            <p key={w} className="ws-card-subtitle">
              {w}
            </p>
          ))}
          {suggested.length > 0 && (
            <div className="yg-pill-row">
              {suggested.map((s) => (
                <button key={s} type="button" className="yw-skill-pill yw-skill-declared" onClick={() => onAddSkill(s)} title="Add as a required skill">
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
