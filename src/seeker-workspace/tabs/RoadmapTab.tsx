import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Circle, Plus, X } from 'lucide-react';
import type { RoadmapMilestone } from '../../lib/database.types';
import { addMilestone, deleteMilestone, listRoadmap, toggleMilestone } from '../../lib/seekerGrowth';
import { formatDate } from '../shared';

const CATEGORY_LABEL: Record<string, string> = {
  foundation: 'Foundation',
  'core-skills': 'Core skills',
  'practical-project': 'Practical project',
  assessment: 'Assessment',
  career: 'Career',
};

interface Props {
  userId: string;
  primaryRole: string;
}

export function RoadmapTab({ userId, primaryRole }: Props) {
  const [items, setItems] = useState<RoadmapMilestone[] | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [target, setTarget] = useState('');

  const reload = useCallback(async () => {
    try {
      setItems(await listRoadmap(userId, primaryRole));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your roadmap.');
    }
  }, [userId, primaryRole]);

  useEffect(() => {
    let live = true;
    listRoadmap(userId, primaryRole)
      .then((d) => live && setItems(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load your roadmap.'));
    return () => {
      live = false;
    };
  }, [userId, primaryRole]);

  async function act(p: Promise<{ error?: string }>) {
    const res = await p;
    setError(res.error ?? '');
    await reload();
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return setError('Name the goal.');
    await act(addMilestone(title, note, target || null, items?.length ?? 0));
    setTitle('');
    setNote('');
    setTarget('');
  }

  const doneCount = items?.filter((m) => m.completed).length ?? 0;
  const pct = items?.length ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card">
        <div className="yg-talent-head">
          <div>
            <p className="yg-eyebrow">Your path{primaryRole ? ` to ${primaryRole}` : ''}</p>
            <h3 className="yg-talent-name">
              {doneCount} of {items?.length ?? 0} milestones done
            </h3>
          </div>
          <strong className="yg-big-num">{pct}%</strong>
        </div>
        <div className="yg-progress" aria-label={`${pct}% complete`}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && (
        <p className="yw-form-error" role="alert">
          {error}
        </p>
      )}
      {!items && !error && <p className="yg-loading">Loading your roadmap…</p>}

      {items && (
        <ol className="yg-roadmap">
          {items.map((m) => (
            <li key={m.id} className={m.completed ? 'is-done' : ''}>
              <button
                type="button"
                className="yg-icon-btn"
                onClick={() => act(toggleMilestone(m))}
                aria-label={m.completed ? `Mark "${m.title}" as not done` : `Mark "${m.title}" as done`}
              >
                {m.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <div>
                <p className="yg-eyebrow">
                  {m.personal ? 'Personal goal' : CATEGORY_LABEL[m.category] ?? m.category}
                  {m.target_date ? ` · by ${formatDate(m.target_date)}` : ''}
                  {m.completed_at ? ` · done ${formatDate(m.completed_at)}` : ''}
                </p>
                <strong>{m.title}</strong>
                {m.description && <p className="ws-card-subtitle">{m.description}</p>}
              </div>
              <button type="button" className="yg-icon-btn" onClick={() => act(deleteMilestone(m.id))} aria-label={`Remove "${m.title}"`}>
                <X size={15} />
              </button>
            </li>
          ))}
        </ol>
      )}

      <form className="ws-card yg-submit-form" onSubmit={add} noValidate>
        <h3 className="ws-card-title">Add a goal</h3>
        <div className="yg-inline-form">
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor="road-title">
              Goal
            </label>
            <input id="road-title" className="yw-form-input" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ship a portfolio project" />
          </div>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor="road-date">
              Target date
            </label>
            <input id="road-date" className="yw-form-input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <button type="submit" className="ob-btn-primary">
            <Plus size={16} aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>
        <div className="yw-form-group">
          <label className="yw-form-label" htmlFor="road-note">
            Notes (optional)
          </label>
          <input id="road-note" className="yw-form-input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </form>
    </div>
  );
}
