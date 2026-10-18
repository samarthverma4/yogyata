import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { BadgeCheck, Search, Send } from 'lucide-react';
import type { TalentResult } from '../../lib/database.types';
import type { InvitationWithName } from '../../lib/talentData';
import { listSentInvitations, searchTalent, sendInvitation, withdrawInvitation } from '../../lib/talentData';
import { LEVEL_LABEL, formatDate } from '../../seeker-workspace/shared';

type RecruiterTab = 'search' | 'invitations';

const STATUS = {
  pending: { label: 'Pending', cls: 'yw-badge-amber' },
  accepted: { label: 'Accepted', cls: 'yw-badge-green' },
  declined: { label: 'Declined', cls: 'yw-badge-neutral' },
} as const;

/** Opted-in talent with proven skills, and invitations to roles. A tab inside the recruiter workspace. */
export function InvitationsPanel({ userId }: { userId: string }) {
  const [tab, setTab] = useState<RecruiterTab>('search');
  const [query, setQuery] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [results, setResults] = useState<TalentResult[] | null>(null);
  const [sent, setSent] = useState<InvitationWithName[]>([]);
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadSent = useCallback(async () => {
    try {
      setSent(await listSentInvitations(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load invitations.');
    }
  }, [userId]);

  // search as the recruiter types, after a short pause
  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      searchTalent(query, verifiedOnly)
        .then((r) => {
          if (!live) return;
          setResults(r);
          setError('');
        })
        .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Search failed.'));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [query, verifiedOnly]);

  useEffect(() => {
    let live = true;
    listSentInvitations(userId)
      .then((s) => live && setSent(s))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load invitations.'));
    return () => {
      live = false;
    };
  }, [userId]);

  const pendingWith = new Set(sent.filter((i) => i.status === 'pending').map((i) => i.seeker_id));

  async function withdraw(inv: InvitationWithName) {
    const res = await withdrawInvitation(inv.id);
    if (res.error) setError(res.error);
    else await loadSent();
  }

  return (
    <>
      <div className="ws-content yg-review-switch" role="tablist" aria-label="Invitations">
        {(['search', 'invitations'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'search' ? 'Invite talent' : `Sent invitations${sent.length ? ` (${sent.length})` : ''}`}
          </button>
        ))}
      </div>
      <div className="ws-content yg-stack">
        {error && (
          <p className="yw-alert yw-alert-danger" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="yg-done" role="status">
            {notice}
          </p>
        )}

        {tab === 'search' && (
          <>
            <div className="ws-card yg-filter-bar">
              <div className="yg-search">
                <Search size={16} aria-hidden="true" />
                <input
                  className="yw-form-input"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by skill, name or headline"
                  aria-label="Search talent"
                />
              </div>
              <label className="yg-check">
                <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                <span>Only people with Verified skills</span>
              </label>
            </div>

            {results === null && !error && <p className="yg-loading">Searching…</p>}
            {results && results.length === 0 && (
              <div className="ws-card ws-empty-state">
                <h4 className="ws-empty-title">{query ? 'Nobody matches yet' : 'No discoverable talent yet'}</h4>
                <p className="ws-empty-desc">
                  People appear here once they opt in to recruiters and have at least one skill assessed by a mentor or
                  verified through founder-reviewed work.
                </p>
              </div>
            )}
            {results && results.length > 0 && (
              <ul className="yg-task-list">
                {results.map((t) => (
                  <li key={t.seeker_id}>
                    <article className="yg-talent-card">
                      <div className="yg-talent-head">
                        <div>
                          <h3 className="yg-talent-name">{t.full_name}</h3>
                          <span className="yg-cell-sub">{[t.headline, t.location].filter(Boolean).join(' · ')}</span>
                        </div>
                      </div>
                      <div className="yg-talent-counts">
                        <span>
                          <strong>{t.verified_count}</strong> verified
                        </span>
                        <span>
                          <strong>{t.assessed_count}</strong> assessed
                        </span>
                      </div>
                      <div className="yg-pill-row" aria-label="Proven skills">
                        {t.skills.map((s) => (
                          <span key={s.name} className={`yw-skill-pill yw-skill-${s.level}`} title={LEVEL_LABEL[s.level]}>
                            {s.level === 'verified' && <BadgeCheck size={13} aria-hidden="true" />}
                            {s.name}
                          </span>
                        ))}
                      </div>
                      {pendingWith.has(t.seeker_id) ? (
                        <span className="yw-badge yw-badge-amber">Invitation pending</span>
                      ) : inviting === t.seeker_id ? (
                        <InviteForm
                          name={t.full_name}
                          onCancel={() => setInviting(null)}
                          onSend={async (role, message) => {
                            const res = await sendInvitation(userId, t.seeker_id, role, message);
                            if (res.error) return res.error;
                            setInviting(null);
                            setNotice(`Invitation sent to ${t.full_name}.`);
                            await loadSent();
                            return '';
                          }}
                        />
                      ) : (
                        <div className="yg-invite-row">
                          <button type="button" className="ob-btn-primary" onClick={() => setInviting(t.seeker_id)}>
                            <Send size={15} aria-hidden="true" />
                            <span>Invite to a role</span>
                          </button>
                        </div>
                      )}
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'invitations' &&
          (sent.length === 0 ? (
            <div className="ws-card ws-empty-state">
              <h4 className="ws-empty-title">No invitations sent</h4>
              <p className="ws-empty-desc">Find someone with the skills you need and invite them to a role.</p>
              <button type="button" className="ob-btn-primary" onClick={() => setTab('search')}>
                Find talent
              </button>
            </div>
          ) : (
            <div className="ws-card yg-table-card">
              <table className="ws-table yg-table">
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Sent</th>
                    <th scope="col">
                      <span className="yg-visually-hidden">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sent.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <strong>{inv.otherName}</strong>
                      </td>
                      <td>
                        {inv.role_title}
                        {inv.message && <span className="yg-cell-sub">{inv.message}</span>}
                      </td>
                      <td>
                        <span className={`yw-badge ${STATUS[inv.status].cls}`}>{STATUS[inv.status].label}</span>
                      </td>
                      <td className="yg-nowrap">{formatDate(inv.created_at)}</td>
                      <td>
                        {inv.status === 'pending' && (
                          <button type="button" className="ob-inline-link-btn" onClick={() => withdraw(inv)}>
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </>
  );
}

function InviteForm({
  name,
  onCancel,
  onSend,
}: {
  name: string;
  onCancel: () => void;
  onSend: (role: string, message: string) => Promise<string>;
}) {
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (role.trim().length < 2) {
      setError('Add the role you are hiring for.');
      return;
    }
    setBusy(true);
    const err = await onSend(role, message);
    setBusy(false);
    setError(err);
  }

  return (
    <form className="yg-ask-form" onSubmit={send} noValidate aria-label={`Invite ${name}`}>
      <div className="yw-form-group">
        <label className="yw-form-label" htmlFor={`invite-role-${name}`}>
          Role
        </label>
        <input
          id={`invite-role-${name}`}
          className="yw-form-input"
          maxLength={120}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Frontend Engineer (Remote)"
        />
      </div>
      <div className="yw-form-group">
        <label className="yw-form-label" htmlFor={`invite-msg-${name}`}>
          Message (optional)
        </label>
        <textarea
          id={`invite-msg-${name}`}
          className="yw-form-textarea"
          rows={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Why their skills fit, and the next step"
        />
      </div>
      {error && (
        <p className="yw-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="yg-form-actions">
        <button type="button" className="ob-btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="ob-btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send invitation'}
        </button>
      </div>
    </form>
  );
}
