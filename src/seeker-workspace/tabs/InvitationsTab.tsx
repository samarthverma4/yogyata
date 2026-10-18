import { useEffect, useState } from 'react';
import type { InvitationWithName } from '../../lib/talentData';
import { getRecruiterVisibility, respondToInvitation, setRecruiterVisibility } from '../../lib/talentData';
import { formatDate } from '../shared';

interface Props {
  userId: string;
  invitations: InvitationWithName[];
  hasProvenSkills: boolean;
  onChanged: () => Promise<void>;
}

const BADGE = {
  pending: { label: 'Waiting for you', cls: 'yw-badge-amber' },
  accepted: { label: 'Accepted', cls: 'yw-badge-green' },
  declined: { label: 'Declined', cls: 'yw-badge-neutral' },
} as const;

export function InvitationsTab({ userId, invitations, hasProvenSkills, onChanged }: Props) {
  // undefined while loading the saved privacy choice
  const [visible, setVisible] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let live = true;
    getRecruiterVisibility(userId).then((v) => live && setVisible(v));
    return () => {
      live = false;
    };
  }, [userId]);

  async function toggle(next: boolean) {
    setBusy('visibility');
    const res = await setRecruiterVisibility(userId, next);
    setBusy('');
    if (res.error) setError(res.error);
    else {
      setError('');
      setVisible(next);
    }
  }

  async function answer(inv: InvitationWithName, status: 'accepted' | 'declined') {
    setBusy(inv.id);
    const res = await respondToInvitation(inv.id, status);
    setBusy('');
    if (res.error) setError(res.error);
    else {
      setError('');
      await onChanged();
    }
  }

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card yg-visibility">
        <div>
          <h3 className="ws-card-title">Visible to recruiters</h3>
          <p className="ws-card-subtitle">
            {visible
              ? hasProvenSkills
                ? 'Recruiters can find you by your Assessed and Verified skills. Declared skills and your onboarding answers stay private.'
                : 'You are visible, but recruiters only see people with at least one Assessed or Verified skill.'
              : 'Recruiters cannot find you. Turn this on to receive invitations based on your proven skills.'}
          </p>
        </div>
        <label className="yg-switch">
          <input
            type="checkbox"
            checked={visible ?? false}
            disabled={visible === undefined || busy === 'visibility'}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span>{visible ? 'On' : 'Off'}</span>
        </label>
      </div>

      {error && (
        <p className="yw-form-error" role="alert">
          {error}
        </p>
      )}

      {invitations.length === 0 ? (
        <div className="ws-card ws-empty-state">
          <h4 className="ws-empty-title">No invitations yet</h4>
          <p className="ws-empty-desc">When a recruiter invites you to a role, it appears here for you to accept or decline.</p>
        </div>
      ) : (
        invitations.map((inv) => (
          <article key={inv.id} className="ws-card yg-invite-card">
            <div className="yg-talent-head">
              <div>
                <p className="yg-eyebrow">{inv.otherName}</p>
                <h3 className="yg-talent-name">{inv.role_title}</h3>
              </div>
              <span className={`yw-badge ${BADGE[inv.status].cls}`}>{BADGE[inv.status].label}</span>
            </div>
            {inv.message && <p className="yg-feedback">“{inv.message}”</p>}
            <span className="yg-cell-sub">
              Received {formatDate(inv.created_at)}
              {inv.responded_at ? ` · answered ${formatDate(inv.responded_at)}` : ''}
            </span>
            {inv.status === 'pending' && (
              <div className="yg-form-actions">
                <button type="button" className="ob-btn-primary" disabled={busy === inv.id} onClick={() => answer(inv, 'accepted')}>
                  Accept
                </button>
                <button type="button" className="ob-btn-secondary" disabled={busy === inv.id} onClick={() => answer(inv, 'declined')}>
                  Decline
                </button>
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}
