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
        <div className="yw-modal-header" style={{ padding: '22px 28px', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <span className="sk-task-org-tag">{task.org_name || 'Founder task'}{task.project_title ? ` · ${task.project_title}` : ''}</span>
            <h2 className="yw-modal-title" id={`${uid}-title`} style={{ marginTop: '8px' }}>
              {task.title}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="yw-modal-body yg-task-detail" style={{ padding: '24px 28px' }}>
          <div className="yg-task-facts" style={{ gap: '10px' }}>
            <span className="sk-task-reward-chip" style={{ background: '#F1F5F9', padding: '6px 12px', borderRadius: '8px' }}>
              <Gift size={15} aria-hidden="true" color="#3559DF" /> {COMPENSATION_LABEL[task.compensation]}
              {task.reward_details ? `: ${task.reward_details}` : ''}
            </span>
            {task.deadline && (
              <span style={{ background: '#F1F5F9', padding: '6px 12px', borderRadius: '8px', color: '#475569', fontWeight: 600 }}>
                <CalendarDays size={15} aria-hidden="true" color="#64748B" /> Due {formatDate(task.deadline)}
              </span>
            )}
          </div>

          {task.required_skills.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Required skills
              </p>
              <div className="yg-pill-row" aria-label="Required skills">
                {task.required_skills.map((s) => {
                  const isMatch = passportNames.has(normalise(s));
                  return (
                    <span key={s} className={isMatch ? 'sk-skill-chip-match' : 'sk-skill-chip-unmatch'}>
                      {isMatch ? `✓ ${s} (in your passport)` : s}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: '14px', margin: '8px 0' }}>
            <Section title="Problem statement">{task.problem_statement}</Section>
            <Section title="Expected deliverable">{task.expected_deliverable}</Section>
            <Section title="Evaluation criteria">{task.evaluation_criteria}</Section>
          </div>

          <hr className="yg-rule" style={{ margin: '14px 0' }} />

          {submission && (
            <div style={{ background: '#F8FAFD', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <StatusBadge status={submission.status} />
                <span style={{ fontSize: '0.82rem', color: '#64748B' }}>Submitted {formatDate(submission.created_at)}</span>
              </div>
              {submission.feedback && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 14px', fontSize: '0.88rem', color: '#1E40AF', marginTop: '6px' }}>
                  <strong>Reviewer feedback:</strong> “{submission.feedback}”
                </div>
              )}
            </div>
          )}

          {editable ? (
            <form className="yg-submit-form" onSubmit={save} noValidate style={{ marginTop: '8px' }}>
              <h3 className="ws-card-title" style={{ fontSize: '1.1rem' }}>{submission ? 'Update your submission' : 'Submit your solution'}</h3>
              <div className="yw-form-group">
                <label className="sk-input-label" htmlFor={`${uid}-url`}>
                  Live deliverable URL (GitHub repo or deployed link)
                </label>
                <input
                  id={`${uid}-url`}
                  className="sk-input-field"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/your-username/project-repo"
                  aria-invalid={error ? true : undefined}
                />
              </div>
              <div className="yw-form-group">
                <label className="sk-input-label" htmlFor={`${uid}-notes`}>
                  Notes for the reviewer (optional)
                </label>
                <textarea
                  id={`${uid}-notes`}
                  className="sk-input-field"
                  rows={4}
                  maxLength={4000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key decisions, architecture choices, how to run or test the deliverable."
                />
              </div>
              {error && (
                <p className="yw-form-error" role="alert">
                  {error}
                </p>
              )}
              {done && (
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', padding: '10px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem' }} role="status">
                  ✓ {done}
                </div>
              )}
              <div className="yg-form-actions" style={{ marginTop: '10px' }}>
                {submission?.status === 'submitted' && (
                  <button type="button" className="ob-btn-secondary" onClick={withdraw} disabled={busy}>
                    Withdraw submission
                  </button>
                )}
                <button type="submit" className="sk-hero-cta" disabled={busy}>
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
