import React, { useState, useMemo } from 'react';
import type {
  TaskSubmission,
  WorkspaceTask,
  SubmissionStatus,
} from '../types';
import { sanitizeUrl } from '../storage';

interface SubmissionsTabProps {
  submissions: TaskSubmission[];
  tasks: WorkspaceTask[];
  selectedTaskId?: string;
  onReviewSubmission: (submission: TaskSubmission) => Promise<{ error?: string }>;
  /** Submissions come from Supabase rather than the local demo. */
  cloud?: boolean;
  loadError?: string;
}

export const SubmissionsTab: React.FC<SubmissionsTabProps> = ({
  submissions,
  tasks,
  selectedTaskId,
  onReviewSubmission,
  cloud = false,
  loadError = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all');
  const [taskFilter, setTaskFilter] = useState<string>(selectedTaskId || 'all');

  // Currently open review modal
  const [reviewingSubmission, setReviewingSubmission] = useState<TaskSubmission | null>(null);

  // Review form state
  const [reviewStatus, setReviewStatus] = useState<SubmissionStatus>('under-review');
  const [reviewNotes, setReviewNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState<number>(4);
  const [isVerifiedEndorsed, setIsVerifiedEndorsed] = useState(false);
  const [endorsedSkill, setEndorsedSkill] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Task map
  const taskMap = useMemo(() => {
    const map = new Map<string, WorkspaceTask>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
      const matchesTask = taskFilter === 'all' || sub.taskId === taskFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        sub.candidateName.toLowerCase().includes(q) ||
        sub.taskTitle.toLowerCase().includes(q) ||
        sub.deliverableNotes.toLowerCase().includes(q);
      return matchesStatus && matchesTask && matchesQuery;
    });
  }, [submissions, statusFilter, taskFilter, searchQuery]);

  const openReviewModal = (sub: TaskSubmission) => {
    setReviewingSubmission(sub);
    setReviewStatus(sub.status);
    setReviewNotes(sub.reviewNotes || '');
    setFeedback(sub.feedback || '');
    setRating(sub.rating || 4);
    setIsVerifiedEndorsed(!!sub.isVerifiedEndorsed);
    setSaveError('');

    const relatedTask = taskMap.get(sub.taskId);
    setEndorsedSkill(sub.endorsedSkill || relatedTask?.requiredSkills[0] || 'Technical Skill');
  };

  // a skill is endorsed only for accepted work (the database enforces the same rule)
  const canEndorse = reviewStatus === 'accepted';

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingSubmission) return;

    const updated: TaskSubmission = {
      ...reviewingSubmission,
      status: reviewStatus,
      reviewNotes: reviewNotes.trim(),
      feedback: feedback.trim(),
      rating,
      isVerifiedEndorsed: canEndorse && isVerifiedEndorsed,
      endorsedSkill: canEndorse && isVerifiedEndorsed ? endorsedSkill : undefined,
      reviewedAt: new Date().toISOString(),
    };

    setSaving(true);
    const res = await onReviewSubmission(updated);
    setSaving(false);
    if (res.error) {
      setSaveError(res.error);
      return;
    }
    setReviewingSubmission(null);
    setSaveSuccessNotice(
      updated.isVerifiedEndorsed
        ? `Evaluation saved. ${updated.endorsedSkill} is now Verified on ${updated.candidateName}'s Skill Passport.`
        : `Evaluation saved for ${updated.candidateName}.`
    );
    setTimeout(() => setSaveSuccessNotice(null), 4000);
  };

  const renderStatusBadge = (s: SubmissionStatus) => {
    switch (s) {
      case 'accepted':
        return <span className="yw-badge yw-badge-green">Accepted</span>;
      case 'under-review':
        return <span className="yw-badge yw-badge-amber">Under Review</span>;
      case 'revision-requested':
        return <span className="yw-badge yw-badge-blue">Revision Requested</span>;
      case 'rejected':
        return <span className="yw-badge yw-badge-danger">Rejected</span>;
      case 'submitted':
        return <span className="yw-badge yw-badge-neutral">Submitted</span>;
    }
  };

  const activeTask = reviewingSubmission ? taskMap.get(reviewingSubmission.taskId) : null;

  return (
    <div className="yw-content">
      {loadError && (
        <div className="yw-alert yw-alert-danger" role="alert" style={{ marginBottom: '1.25rem' }}>
          <div>Submissions could not be loaded: {loadError}</div>
        </div>
      )}
      {saveSuccessNotice && (
        <div className="yw-alert yw-alert-success" role="status" style={{ marginBottom: '1.25rem' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>{saveSuccessNotice}</div>
        </div>
      )}

      {/* Notice about prototype submission & deliberate skill verification */}
      <div className="yw-alert yw-alert-info" style={{ marginBottom: '1.25rem' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <strong>Skill Passport Integrity Principle:</strong> Submitting a deliverable does not
          automatically verify a skill. Verified status requires explicit review and endorsement of
          demonstrated evidence by the evaluator.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="yw-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <input
                type="text"
                className="yw-form-input"
                placeholder="Search candidate / task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
                id="input-search-submissions"
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="#94A3B8"
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Filter by Task */}
            <select
              className="yw-form-select"
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="all">All Tasks</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>

            {/* Status pills */}
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {(
                [
                  'all',
                  'submitted',
                  'under-review',
                  'accepted',
                  'revision-requested',
                  'rejected',
                ] as const
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`yw-btn yw-btn-sm ${
                    statusFilter === st ? 'yw-btn-primary' : 'yw-btn-secondary'
                  }`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all'
                    ? 'All'
                    : st.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submissions List / Table */}
      {filteredSubmissions.length === 0 ? (
        <div className="yw-card">
          <div className="yw-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="yw-empty-state-title">No submissions match the selected filters</p>
            <p className="yw-empty-state-desc">
              When candidates submit pull requests or design artifacts for your published tasks,
              they appear here for evaluation.
            </p>
            <button
              type="button"
              className="yw-btn yw-btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTaskFilter('all');
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="yw-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="yw-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Task Challenge</th>
                  <th>Deliverable</th>
                  <th>Status</th>
                  <th>Rating & Skill Proof</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((sub) => {
                  return (
                    <tr key={sub.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--color-border)',
                              color: 'var(--color-navy)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.875rem',
                            }}
                          >
                            {sub.candidateName[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-navy)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              {sub.candidateName}
                              {sub.isDemoRecord && (
                                <span className="yw-badge yw-badge-neutral" style={{ fontSize: '0.65rem' }}>
                                  DEMO
                                </span>
                              )}
                            </div>
                            {sub.candidateEmail && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                {sub.candidateEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--color-navy)' }}>{sub.taskTitle}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-faint)' }}>
                          Submitted: {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <a
                          href={sanitizeUrl(sub.deliverableUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#D97706',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          View Work ↗
                        </a>
                        <p style={{ margin: '0.125rem 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.75rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sub.deliverableNotes}
                        </p>
                      </td>
                      <td>{renderStatusBadge(sub.status)}</td>
                      <td>
                        {sub.rating ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#D97706', fontSize: '0.875rem' }}>
                            {'★'.repeat(sub.rating)}
                            {'☆'.repeat(5 - sub.rating)}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-faint)', fontSize: '0.75rem' }}>Not rated</span>
                        )}
                        {sub.isVerifiedEndorsed && (
                          <div style={{ marginTop: '0.25rem' }}>
                            <span className="yw-skill-pill yw-skill-verified" style={{ fontSize: '0.7rem' }}>
                              ✓ {sub.endorsedSkill}
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="yw-btn yw-btn-primary yw-btn-sm"
                          onClick={() => openReviewModal(sub)}
                          id={`btn-review-${sub.id}`}
                        >
                          {sub.status === 'under-review' || sub.status === 'submitted'
                            ? 'Evaluate Work'
                            : 'Update Review'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── REVIEW SUBMISSION MODAL ─── */}
      {reviewingSubmission && (
        <div className="yw-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-review-sub-title">
          <div className="yw-modal-box" style={{ maxWidth: '680px' }}>
            <div className="yw-modal-header">
              <div>
                <span className="yw-badge yw-badge-blue">Deliverable Evaluation</span>
                <h3 id="modal-review-sub-title" className="yw-modal-title" style={{ marginTop: '0.25rem' }}>
                  Review Work: {reviewingSubmission.candidateName}
                </h3>
              </div>
              <button
                type="button"
                className="yw-modal-close"
                onClick={() => setReviewingSubmission(null)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReview}>
              <div className="yw-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Deliverable Details Box */}
                <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--color-navy)', fontSize: '0.9375rem' }}>
                      Task: {reviewingSubmission.taskTitle}
                    </strong>
                    <a
                      href={sanitizeUrl(reviewingSubmission.deliverableUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="yw-btn yw-btn-secondary yw-btn-sm"
                    >
                      Open Submitted URL ↗
                    </a>
                  </div>

                  <p style={{ margin: '0.75rem 0 0.25rem 0', color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                    <strong>Candidate Deliverable Notes:</strong> {reviewingSubmission.deliverableNotes}
                  </p>

                  {activeTask?.evaluationCriteria && (
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      <strong>Evaluation Criteria:</strong> {activeTask.evaluationCriteria}
                    </div>
                  )}
                </div>

                {/* Evaluation Controls */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="yw-form-group">
                    <label className="yw-form-label" htmlFor="review-status-select">
                      Evaluation Decision *
                    </label>
                    <select
                      id="review-status-select"
                      className="yw-form-select"
                      value={reviewStatus}
                      onChange={(e) => {
                        const nextStatus = e.target.value as SubmissionStatus;
                        setReviewStatus(nextStatus);
                        if (nextStatus !== 'accepted') {
                          setIsVerifiedEndorsed(false);
                        }
                      }}
                    >
                      <option value="under-review">Under Review</option>
                      <option value="accepted">Accepted / Approved</option>
                      <option value="revision-requested">Revision Requested</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="yw-form-group">
                    <label className="yw-form-label">Deliverable Rating (1–5 Stars)</label>
                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            color: star <= rating ? '#D97706' : 'var(--color-border-hover)',
                            padding: '0 2px',
                          }}
                          title={`Rate ${star} stars`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="review-feedback">
                    Feedback for Candidate
                  </label>
                  <textarea
                    id="review-feedback"
                    rows={3}
                    className="yw-form-textarea"
                    placeholder="Specific remarks on code quality, architecture choices, accessibility, or design implementation..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>

                <div className="yw-form-group">
                  <label className="yw-form-label" htmlFor="review-internal-notes">
                    Internal Founder Notes (Private)
                  </label>
                  <textarea
                    id="review-internal-notes"
                    rows={2}
                    className="yw-form-textarea"
                    placeholder="Private notes for your startup team..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>

                {/* Explicit Skill Passport Verification Box */}
                <div
                  style={{
                    background: reviewStatus === 'accepted' ? '#F0FDF4' : 'var(--color-bg)',
                    border: `1px solid ${reviewStatus === 'accepted' ? '#BBF7D0' : 'var(--color-border)'}`,
                    borderRadius: '8px',
                    padding: '1rem',
                    opacity: reviewStatus === 'accepted' ? 1 : 0.75,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <input
                      id="check-endorse-skill"
                      type="checkbox"
                      checked={canEndorse && isVerifiedEndorsed}
                      disabled={!canEndorse}
                      onChange={(e) => setIsVerifiedEndorsed(e.target.checked)}
                      style={{
                        marginTop: '0.25rem',
                        width: '16px',
                        height: '16px',
                        cursor: reviewStatus === 'accepted' ? 'pointer' : 'not-allowed',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <label
                        htmlFor="check-endorse-skill"
                        style={{
                          fontWeight: 600,
                          color: reviewStatus === 'accepted' ? '#166534' : 'var(--color-text-muted)',
                          fontSize: '0.9375rem',
                          cursor: reviewStatus === 'accepted' ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Endorse Practical Skill Verification for Candidate's Skill Passport
                      </label>
                      <p style={{ margin: '0.25rem 0 0 0', color: reviewStatus === 'accepted' ? '#15803D' : 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.4 }}>
                        {reviewStatus === 'accepted'
                          ? 'By checking this box, you confirm that you reviewed the submitted practical work and that it directly demonstrates proficiency in the selected competency.'
                          : 'Practical skill verification endorsement is only enabled when the submission status is Accepted / Approved.'}
                      </p>

                      {!canEndorse && (
                        <p style={{ margin: '0.5rem 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          Set the decision to Accepted to endorse a skill.
                        </p>
                      )}

                      {canEndorse && isVerifiedEndorsed && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label htmlFor="select-endorsed-skill" style={{ fontSize: '0.8125rem', color: '#166534', fontWeight: 600 }}>
                            Select Skill to Verify:
                          </label>
                          <select
                            id="select-endorsed-skill"
                            className="yw-form-select"
                            style={{ maxWidth: '240px', background: '#FFFFFF' }}
                            value={endorsedSkill}
                            onChange={(e) => setEndorsedSkill(e.target.value)}
                          >
                            {activeTask?.requiredSkills.map((sk) => (
                              <option key={sk} value={sk}>
                                {sk}
                              </option>
                            )) || <option value="Technical Execution">Technical Execution</option>}
                          </select>
                        </div>
                      )}

                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#65A30D' }}>
                        {cloud
                          ? '* The skill becomes Verified on the candidate’s Skill Passport, linked to this submission as evidence.'
                          : '* Local prototype evaluation. Nothing leaves this browser.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="yw-modal-footer">
                {saveError && (
                  <p className="yw-alert yw-alert-danger" role="alert" style={{ margin: '0 auto 0 0' }}>
                    {saveError}
                  </p>
                )}
                <button
                  type="button"
                  className="yw-btn yw-btn-secondary"
                  onClick={() => setReviewingSubmission(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="yw-btn yw-btn-primary" id="btn-save-evaluation" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
