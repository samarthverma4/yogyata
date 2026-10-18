import { useCallback, useEffect, useId, useState } from 'react';
import { CheckCircle2, Clock, X, XCircle } from 'lucide-react';
import type { AssessmentAttempt, AttemptReview } from '../../lib/database.types';
import { listAssessments, submitAssessment, type Assessment } from '../../lib/seekerGrowth';
import { formatDate } from '../shared';

interface Props {
  userId: string;
  /** Passing an assessment changes the passport, so the workspace reloads it. */
  onPassed: () => Promise<void>;
}

export function AssessmentsTab({ userId, onPassed }: Props) {
  const [data, setData] = useState<{ assessments: Assessment[]; attempts: AssessmentAttempt[] } | null>(null);
  const [error, setError] = useState('');
  const [taking, setTaking] = useState<Assessment | null>(null);
  const [result, setResult] = useState<{ assessment: Assessment; attempt: AssessmentAttempt } | null>(null);
  // one clock reading per visit is enough for the retake countdown
  const [now] = useState(Date.now);

  const reload = useCallback(async () => {
    try {
      setData(await listAssessments(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load assessments.');
    }
  }, [userId]);

  useEffect(() => {
    let live = true;
    listAssessments(userId)
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load assessments.'));
    return () => {
      live = false;
    };
  }, [userId]);

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card">
        <p className="yg-eyebrow">How assessments work</p>
        <p className="ws-card-subtitle">
          Short multiple-choice tests, scored by Yogyata rather than in your browser. Pass one and the skill becomes Assessed on your
          Skill Passport. You can retake a test one hour after your last attempt.
        </p>
      </div>
      {error && (
        <p className="yw-alert yw-alert-danger" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p className="yg-loading">Loading assessments…</p>}
      {data && (
        <ul className="yg-task-list">
          {data.assessments.map((a) => {
            const mine = data.attempts.filter((t) => t.assessment_id === a.id);
            const best = mine.reduce<AssessmentAttempt | null>((b, t) => (!b || t.score_percent > b.score_percent ? t : b), null);
            const last = mine[0];
            const waitMs = last ? Date.parse(last.created_at) + 3_600_000 - now : 0;
            return (
              <li key={a.id}>
                <article className="yg-talent-card">
                  <div className="yg-talent-head">
                    <div>
                      <p className="yg-eyebrow">
                        {a.category} · {a.difficulty}
                      </p>
                      <h3 className="yg-talent-name">{a.title}</h3>
                    </div>
                    {best?.passed && <span className="yw-badge yw-badge-green">Passed</span>}
                  </div>
                  <p className="yg-task-summary">{a.description}</p>
                  <div className="yg-talent-counts">
                    <span>
                      <Clock size={13} aria-hidden="true" /> {a.duration_minutes} min
                    </span>
                    <span>{a.questions.length} questions</span>
                    <span>Pass at {a.pass_percent}%</span>
                    {best && (
                      <span>
                        Best <strong>{best.score_percent}%</strong>
                      </span>
                    )}
                  </div>
                  <div className="yg-invite-row">
                    <span className={`yw-skill-pill yw-skill-${best?.passed ? 'assessed' : 'declared'}`}>{a.skill}</span>
                    <button type="button" className="ob-btn-primary" disabled={waitMs > 0} onClick={() => setTaking(a)}>
                      {waitMs > 0 ? `Retake in ${Math.ceil(waitMs / 60000)} min` : mine.length ? 'Retake' : 'Start'}
                    </button>
                    {last && (
                      <button type="button" className="ob-inline-link-btn" onClick={() => setResult({ assessment: a, attempt: last })}>
                        Review last attempt
                      </button>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {taking && (
        <TakeAssessment
          assessment={taking}
          onClose={() => setTaking(null)}
          onSubmitted={async (attempt) => {
            setTaking(null);
            setResult({ assessment: taking, attempt });
            await reload();
            if (attempt.passed) await onPassed();
          }}
        />
      )}
      {result && <ResultModal {...result} onClose={() => setResult(null)} />}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
}

function TakeAssessment({
  assessment,
  onClose,
  onSubmitted,
}: {
  assessment: Assessment;
  onClose: () => void;
  onSubmitted: (a: AssessmentAttempt) => Promise<void>;
}) {
  const uid = useId();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEscape(onClose);
  const q = assessment.questions[index];
  const answered = Object.keys(answers).length;
  const last = index === assessment.questions.length - 1;

  async function submit() {
    if (answered < assessment.questions.length) {
      setError(`Answer all ${assessment.questions.length} questions first (${answered} done).`);
      return;
    }
    setBusy(true);
    const res = await submitAssessment(assessment.id, answers);
    setBusy(false);
    if (res.error || !res.attempt) setError(res.error ?? 'Could not submit.');
    else await onSubmitted(res.attempt);
  }

  return (
    <div className="yw-modal-overlay">
      <div className="yw-modal-box yg-modal-wide" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`}>
        <div className="yw-modal-header">
          <div>
            <p className="yg-eyebrow">
              Question {index + 1} of {assessment.questions.length}
            </p>
            <h2 className="yw-modal-title" id={`${uid}-t`}>
              {assessment.title}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close without submitting">
            <X size={18} />
          </button>
        </div>
        <div className="yw-modal-body yg-stack">
          <div className="yg-progress" aria-hidden="true">
            <span style={{ width: `${((index + 1) / assessment.questions.length) * 100}%` }} />
          </div>
          <fieldset className="yg-question">
            <legend>{q.text}</legend>
            {q.options.map((opt, i) => (
              <label key={i} className={`yg-option ${answers[q.id] === i ? 'is-selected' : ''}`}>
                <input type="radio" name={`${uid}-${q.id}`} checked={answers[q.id] === i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} />
                <span>{opt}</span>
              </label>
            ))}
          </fieldset>
          {error && (
            <p className="yw-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="yg-form-actions">
            <button type="button" className="ob-btn-secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Back
            </button>
            {last ? (
              <button type="button" className="ob-btn-primary" disabled={busy} onClick={submit}>
                {busy ? 'Scoring…' : 'Submit answers'}
              </button>
            ) : (
              <button type="button" className="ob-btn-primary" onClick={() => setIndex((i) => i + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultModal({ assessment, attempt, onClose }: { assessment: Assessment; attempt: AssessmentAttempt; onClose: () => void }) {
  const uid = useId();
  useEscape(onClose);
  const review = attempt.review as unknown as AttemptReview[];
  return (
    <div className="yw-modal-overlay" onClick={onClose}>
      <div className="yw-modal-box yg-modal-wide" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={(e) => e.stopPropagation()}>
        <div className="yw-modal-header">
          <div>
            <p className="yg-eyebrow">{formatDate(attempt.created_at)}</p>
            <h2 className="yw-modal-title" id={`${uid}-t`}>
              {attempt.passed ? `Passed with ${attempt.score_percent}%` : `${attempt.score_percent}%: not passed yet`}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="yw-modal-body yg-stack">
          <p className={attempt.passed ? 'yg-done' : 'ws-card-subtitle'}>
            {attempt.passed
              ? `${assessment.skill} is now Assessed on your Skill Passport.`
              : `You got ${attempt.correct} of ${attempt.total}. You need ${assessment.pass_percent}% to pass. Read the explanations and try again in an hour.`}
          </p>
          {assessment.questions.map((q, i) => {
            const r = review.find((x) => x.questionId === q.id);
            const right = r && r.chosen === r.correct;
            return (
              <section key={q.id} className="yg-task-section">
                <h3 className="yg-form-title">
                  {right ? <CheckCircle2 size={16} className="yg-ok" aria-label="Correct" /> : <XCircle size={16} className="yg-bad" aria-label="Incorrect" />}{' '}
                  {i + 1}. {q.text}
                </h3>
                <p className="ws-card-subtitle">
                  Your answer: {r?.chosen != null ? q.options[r.chosen] : 'none'}
                  {!right && r && (
                    <>
                      <br />
                      Correct answer: {q.options[r.correct]}
                    </>
                  )}
                </p>
                {r?.explanation && <p className="yg-feedback">{r.explanation}</p>}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
