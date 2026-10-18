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
          <h4 className="ws-empty-title">No submissions yet</h4>
          <p className="ws-empty-desc">Pick a founder task, solve it, and share a link to your work. Reviewed work becomes Verified skills.</p>
          <button type="button" className="ob-btn-primary" onClick={onBrowse}>
            Browse tasks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ws-content">
      <div className="ws-card yg-table-card">
        <table className="ws-table yg-table">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Status</th>
              <th scope="col">Submitted</th>
              <th scope="col">Feedback</th>
              <th scope="col">
                <span className="yg-visually-hidden">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.task?.title ?? 'Task no longer available'}</strong>
                  <span className="yg-cell-sub">{s.task?.org_name}</span>
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td className="yg-nowrap">{formatDate(s.created_at)}</td>
                <td className="yg-feedback-cell">{s.feedback || <span className="yg-muted">Waiting for review</span>}</td>
                <td>
                  {s.task && (
                    <button type="button" className="ob-inline-link-btn" onClick={() => onOpen(s)}>
                      {canEditSubmission(s.status) ? 'View or edit' : 'View'}
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
