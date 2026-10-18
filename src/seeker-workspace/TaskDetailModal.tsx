import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { X, Send, CalendarDays, Gift } from 'lucide-react';
import type { TaskRow } from '../lib/database.types';
import type { SubmissionWithTask } from '../lib/seekerData';
import { submitWork, withdrawSubmission } from '../lib/seekerData';
import { COMPENSATION_LABEL, canEditSubmission, formatDate, normalise } from './shared';
import { StatusBadge } from './StatusBadge';

interface Props {
  userId: string;
  task: TaskRow;
  submission?: SubmissionWithTask;
  passportNames: Set<string>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const URL_OK = /^https?:\/\/\S+\.\S+/i;

export function TaskDetailModal({ userId, task, submission, passportNames, onClose, onSaved }: Props) {
  const uid = useId();
  const editable = !submission || canEditSubmission(submission.status);
  const [url, setUrl] = useState(submission?.deliverable_url ?? '');
  const [notes, setNotes] = useState(submission?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!URL_OK.test(url.trim())) {
      setError('Add a link to your work that starts with https://, for example a GitHub repo or a deployed site.');
      return;
    }
    setBusy(true);
    const res = await submitWork(userId, task.id, url, notes, submission?.id);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError('');
    setDone(submission ? 'Your submission was updated.' : 'Submitted. The founder will review it against the rubric.');
    await onSaved();
  }

  async function withdraw() {
    if (!submission) return;
    setBusy(true);
    const res = await withdrawSubmission(submission.id);
    setBusy(false);
    if (res.error) setError(res.error);
    else {
      await onSaved();
      onClose();
    }
  }

  return (
    <div className="yw-modal-overlay" onClick={onClose}>
      <div
        className="yw-modal-box yg-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="yw-modal-header">
          <div>
            <p className="yg-eyebrow">{task.org_name || 'Founder task'}{task.project_title ? ` · ${task.project_title}` : ''}</p>
            <h2 className="yw-modal-title" id={`${uid}-title`}>
              {task.title}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="yw-modal-body yg-task-detail">
          <div className="yg-task-facts">
            <span>
              <Gift size={15} aria-hidden="true" /> {COMPENSATION_LABEL[task.compensation]}
              {task.reward_details ? `: ${task.reward_details}` : ''}
            </span>
            {task.deadline && (
              <span>
                <CalendarDays size={15} aria-hidden="true" /> Due {formatDate(task.deadline)}
              </span>
            )}
          </div>

          {task.required_skills.length > 0 && (
            <div className="yg-pill-row" aria-label="Required skills">
              {task.required_skills.map((s) => (
                <span key={s} className={`yw-skill-pill ${passportNames.has(normalise(s)) ? 'yw-skill-verified' : 'yw-skill-declared'}`}>
                  {s}
                </span>
              ))}
            </div>
          )}

          <Section title="Problem">{task.problem_statement}</Section>
          <Section title="What to deliver">{task.expected_deliverable}</Section>
          <Section title="How it will be judged">{task.evaluation_criteria}</Section>

          <hr className="yg-rule" />

          {submission && (
            <div className="yg-submission-state">
              <StatusBadge status={submission.status} />
              <span>Submitted {formatDate(submission.created_at)}</span>
              {submission.feedback && <p className="yg-feedback">“{submission.feedback}”</p>}
            </div>
          )}

          {editable ? (
            <form className="yg-submit-form" onSubmit={save} noValidate>
              <h3 className="yg-form-title">{submission ? 'Update your submission' : 'Submit your work'}</h3>
              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor={`${uid}-url`}>
                  Link to your work
                </label>
                <input
                  id={`${uid}-url`}
                  className="yw-form-input"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/you/solution"
                  aria-invalid={error ? true : undefined}
                />
              </div>
              <div className="yw-form-group">
                <label className="yw-form-label" htmlFor={`${uid}-notes`}>
                  Notes for the reviewer (optional)
                </label>
                <textarea
                  id={`${uid}-notes`}
                  className="yw-form-textarea"
                  rows={4}
                  maxLength={4000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What you built, choices you made, and how to run it."
                />
              </div>
              {error && (
                <p className="yw-form-error" role="alert">
                  {error}
                </p>
              )}
              {done && (
                <p className="yg-done" role="status">
                  {done}
                </p>
              )}
              <div className="yg-form-actions">
                {submission?.status === 'submitted' && (
                  <button type="button" className="ob-btn-secondary" onClick={withdraw} disabled={busy}>
                    Withdraw
                  </button>
                )}
                <button type="submit" className="ob-btn-primary" disabled={busy}>
                  <Send size={15} aria-hidden="true" />
                  <span>{busy ? 'Saving…' : submission ? 'Update submission' : 'Submit work'}</span>
                </button>
              </div>
            </form>
          ) : (
            <p className="ws-card-subtitle">This submission has been reviewed, so it can no longer be changed.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  if (!children.trim()) return null;
  return (
    <section className="yg-task-section">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
  );
}
