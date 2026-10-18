import type { SubmissionWithTask } from '../../lib/seekerData';
import { canEditSubmission, formatDate } from '../shared';
import { StatusBadge } from '../StatusBadge';

interface Props {
  submissions: SubmissionWithTask[];
  onOpen: (submission: SubmissionWithTask) => void;
  onBrowse: () => void;
}

export function SubmissionsTab({ submissions, onOpen, onBrowse }: Props) {
  if (submissions.length === 0) {
    return (
      <div className="ws-content">
        <div className="ws-card ws-empty-state">
          <div className="ws-stat-icon-wrap" style={{ background: '#EEF4FF', color: '#2545C6', marginBottom: '16px', width: '56px', height: '56px', borderRadius: '16px' }}>
            <span style={{ fontSize: '1.5rem' }}>📂</span>
          </div>
          <h4 className="ws-empty-title">No submissions yet</h4>
          <p className="ws-empty-desc">Pick a founder problem, submit your solution link, and get your work reviewed to earn Verified skills on your passport.</p>
          <button type="button" className="sk-hero-cta" onClick={onBrowse}>
            Browse founder tasks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card" style={{ paddingBottom: 0 }}>
        <div className="sk-section-header" style={{ marginBottom: 0, paddingBottom: '16px' }}>
          <div>
            <h3 className="ws-card-title">Submitted solutions</h3>
            <p className="ws-card-subtitle" style={{ marginBottom: 0 }}>Track reviewer feedback and make revisions when requested.</p>
          </div>
          <span className="sk-match-tag">{submissions.length} total</span>
        </div>
      </div>

      <div className="ws-card yg-table-card">
        <table className="ws-table yg-table">
          <thead>
            <tr>
              <th scope="col">Task & Startup</th>
              <th scope="col">Status</th>
              <th scope="col">Submitted</th>
              <th scope="col">Reviewer Feedback</th>
              <th scope="col" style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong style={{ display: 'block', color: '#0F1A44', fontSize: '0.94rem' }}>{s.task?.title ?? 'Task no longer available'}</strong>
                  <span className="yg-cell-sub" style={{ marginTop: '2px' }}>{s.task?.org_name || 'Founder project'}</span>
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td className="yg-nowrap" style={{ color: '#64748B', fontSize: '0.86rem' }}>{formatDate(s.created_at)}</td>
                <td className="yg-feedback-cell">
                  {s.feedback ? (
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.84rem', color: '#334155' }}>
                      “{s.feedback}”
                    </div>
                  ) : (
                    <span style={{ color: '#94A3B8', fontSize: '0.84rem' }}>Waiting for review</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {s.task && (
                    <button
                      type="button"
                      className="ob-inline-link-btn"
                      onClick={() => onOpen(s)}
                      style={{ fontWeight: 700, fontSize: '0.84rem' }}
                    >
                      {canEditSubmission(s.status) ? 'View / Edit →' : 'View →'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
