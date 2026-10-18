import { useCallback, useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { decideReview, listMentorReviews } from '../../lib/reviewData';
import type { ReviewWithSeeker } from '../../lib/reviewData';
import { formatDate } from '../../seeker-workspace/shared';

type MentorTab = 'queue' | 'reviewed';

/** Skill-assessment requests from seekers, shown as a tab inside the mentor workspace. */
export function SkillReviewPanel({ userId, onCountChange }: { userId: string; onCountChange?: (open: number) => void }) {
  const [tab, setTab] = useState<MentorTab>('queue');
  const [data, setData] = useState<{ queue: ReviewWithSeeker[]; history: ReviewWithSeeker[] } | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<ReviewWithSeeker | null>(null);
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    try {
      setData(await listMentorReviews(userId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load reviews.');
    }
  }, [userId]);

  useEffect(() => {
    let live = true;
    listMentorReviews(userId)
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load reviews.'));
    return () => {
      live = false;
    };
  }, [userId]);

  useEffect(() => {
    if (data) onCountChange?.(data.queue.length);
  }, [data, onCountChange]);

  return (
    <>
      <div className="ws-content yg-review-switch" role="tablist" aria-label="Skill reviews">
        {(['queue', 'reviewed'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'queue' ? `Open requests${data ? ` (${data.queue.length})` : ''}` : 'My decisions'}
          </button>
        ))}
      </div>
      <div className="ws-content yg-stack">
        {error && (
          <p className="yw-alert yw-alert-danger" role="alert">
            {error}{' '}
            <button type="button" className="ob-inline-link-btn" onClick={reload}>
              Try again
            </button>
          </p>
        )}
        {notice && (
          <p className="yg-done" role="status">
            {notice}
          </p>
        )}
        {!data && !error && <p className="yg-loading">Loading reviews…</p>}

        {data && tab === 'queue' && (
          <>
            <div className="ws-card">
              <p className="yg-eyebrow">How assessment works</p>
              <p className="ws-card-subtitle">
                Open the seeker's evidence and judge whether it shows the skill. Assessing moves the skill from Declared to
                Assessed on their Skill Passport. Only founder-reviewed task work makes a skill Verified.
              </p>
            </div>
            {data.queue.length === 0 ? (
              <div className="ws-card ws-empty-state">
                <h4 className="ws-empty-title">The queue is clear</h4>
                <p className="ws-empty-desc">New requests from seekers appear here, oldest first.</p>
              </div>
            ) : (
              <ul className="yg-task-list">
                {data.queue.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="ws-card yg-task-card" onClick={() => setOpen(r)}>
                      <span className="yg-eyebrow">{r.seekerName}</span>
                      <span className="yg-task-title">
                        <span className="yw-skill-pill yw-skill-declared">{r.skill_name}</span>
                      </span>
                      {r.note && <span className="yg-task-summary">{r.note}</span>}
                      <span className="yg-task-foot">
                        <span>Requested {formatDate(r.created_at)}</span>
                        <span className="yg-go">Review evidence</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {data && tab === 'reviewed' && (
          data.history.length === 0 ? (
            <div className="ws-card ws-empty-state">
              <h4 className="ws-empty-title">No reviews yet</h4>
              <p className="ws-empty-desc">Skills you assess or decline are listed here.</p>
            </div>
          ) : (
            <div className="ws-card yg-table-card">
              <table className="ws-table yg-table">
                <thead>
                  <tr>
                    <th scope="col">Skill</th>
                    <th scope="col">Seeker</th>
                    <th scope="col">Decision</th>
                    <th scope="col">Feedback</th>
                    <th scope="col">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.skill_name}</strong>
                      </td>
                      <td>{r.seekerName}</td>
                      <td>
                        <span className={`yw-badge ${r.status === 'assessed' ? 'yw-badge-green' : 'yw-badge-neutral'}`}>
                          {r.status === 'assessed' ? 'Assessed' : 'Declined'}
                        </span>
                      </td>
                      <td className="yg-feedback-cell">{r.feedback || <span className="yg-muted">No feedback</span>}</td>
                      <td className="yg-nowrap">{formatDate(r.reviewed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {open && (
        <ReviewModal
          review={open}
          onClose={() => setOpen(null)}
          onDone={async (msg) => {
            setOpen(null);
            setNotice(msg);
            await reload();
          }}
        />
      )}
    </>
  );
}

function ReviewModal({
  review,
  onClose,
  onDone,
}: {
  review: ReviewWithSeeker;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const uid = useId();
  const [decision, setDecision] = useState<'assessed' | 'declined'>('assessed');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (decision === 'declined' && !feedback.trim()) {
      setError('Tell the seeker what is missing, so they can improve the evidence.');
      return;
    }
    setBusy(true);
    const res = await decideReview(review.id, decision, feedback);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await onDone(
      decision === 'assessed'
        ? `${review.skill_name} is now Assessed on ${review.seekerName}'s Skill Passport.`
        : `Feedback sent to ${review.seekerName}.`,
    );
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
            <p className="yg-eyebrow">{review.seekerName}</p>
            <h2 className="yw-modal-title" id={`${uid}-title`}>
              Assess {review.skill_name}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="yw-modal-body yg-submit-form" onSubmit={save} noValidate>
          <section className="yg-task-section">
            <h3 className="yg-form-title">Evidence</h3>
            <a className="ob-btn-secondary" href={review.evidence_url} target="_blank" rel="noreferrer noopener">
              <span>Open evidence</span>
              <ExternalLink size={15} aria-hidden="true" />
            </a>
            {review.note && <p className="yg-feedback">“{review.note}”</p>}
          </section>

          <hr className="yg-rule" />

          <fieldset className="yw-form-group">
            <legend className="yw-form-label">Decision</legend>
            <label className="yg-check">
              <input type="radio" name={`${uid}-decision`} checked={decision === 'assessed'} onChange={() => setDecision('assessed')} />
              <span>The evidence shows this skill: mark it Assessed</span>
            </label>
            <label className="yg-check">
              <input type="radio" name={`${uid}-decision`} checked={decision === 'declined'} onChange={() => setDecision('declined')} />
              <span>Not yet: send feedback</span>
            </label>
          </fieldset>

          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={`${uid}-feedback`}>
              Feedback for the seeker {decision === 'declined' ? '(required)' : '(optional)'}
            </label>
            <textarea
              id={`${uid}-feedback`}
              className="yw-form-textarea"
              rows={4}
              maxLength={2000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What was strong, and what would make the evidence stronger"
            />
          </div>

          {error && (
            <p className="yw-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="yg-form-actions">
            <button type="button" className="ob-btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="ob-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : decision === 'assessed' ? 'Mark as Assessed' : 'Send feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
