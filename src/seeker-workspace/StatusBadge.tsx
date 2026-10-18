import type { SubmissionStatus } from '../lib/database.types';

const STATUS: Record<SubmissionStatus, { label: string; className: string }> = {
  submitted: { label: 'Submitted', className: 'status-submitted' },
  under_review: { label: 'Under review', className: 'status-under_review' },
  accepted: { label: 'Accepted', className: 'status-accepted' },
  revision_requested: { label: 'Revision requested', className: 'status-revision_requested' },
  rejected: { label: 'Not selected', className: 'status-rejected' },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS[status] ?? STATUS.submitted;
  return (
    <span className={`sk-status-badge ${s.className}`}>
      <span className="sk-status-dot" aria-hidden="true" />
      <span>{s.label}</span>
    </span>
  );
}

