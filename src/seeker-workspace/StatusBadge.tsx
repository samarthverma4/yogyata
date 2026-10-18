import type { SubmissionStatus } from '../lib/database.types';

const STATUS: Record<SubmissionStatus, { label: string; badge: string }> = {
  submitted: { label: 'Submitted', badge: 'yw-badge-blue' },
  under_review: { label: 'Under review', badge: 'yw-badge-amber' },
  accepted: { label: 'Accepted', badge: 'yw-badge-green' },
  revision_requested: { label: 'Revision requested', badge: 'yw-badge-amber' },
  rejected: { label: 'Not selected', badge: 'yw-badge-neutral' },
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS[status];
  return <span className={`yw-badge ${s.badge}`}>{s.label}</span>;
}

