import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, MapPin, Search, Video, X } from 'lucide-react';
import { APPLICATION_LABEL, applyToPosting, listMyApplications, listOpenPostings, withdrawApplication } from '../../lib/postingData';
import type { MyApplication, OpenPosting } from '../../lib/postingData';
import { listMyInterviews, type MyInterview } from '../../lib/seekerGrowth';
import { formatDate, normalise } from '../shared';

interface Props {
  userId: string;
  passportNames: Set<string>;
}

type View = 'roles' | 'applications';

const APP_BADGE: Record<MyApplication['status'], string> = {
  applied: 'yw-badge-blue',
  in_review: 'yw-badge-amber',
  interview: 'yw-badge-amber',
  offer: 'yw-badge-green',
  rejected: 'yw-badge-neutral',
  withdrawn: 'yw-badge-neutral',
};

/** Roles recruiters published, the seeker's applications, and interviews scheduled with them. */
export function OpportunitiesTab({ userId, passportNames }: Props) {
  const [view, setView] = useState<View>('roles');
  const [postings, setPostings] = useState<OpenPosting[] | null>(null);
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [interviews, setInterviews] = useState<MyInterview[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState<OpenPosting | null>(null);
  const [now] = useState(Date.now);

  const fetchAll = useCallback(
    () => Promise.all([listOpenPostings(), listMyApplications(userId), listMyInterviews(userId)]),
    [userId],
  );
  const reload = useCallback(async () => {
    try {
      const [p, a, i] = await fetchAll();
      setPostings(p);
      setApps(a);
      setInterviews(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load opportunities.');
    }
  }, [fetchAll]);

  useEffect(() => {
    let live = true;
    fetchAll()
      .then(([p, a, i]) => {
        if (!live) return;
        setPostings(p);
        setApps(a);
        setInterviews(i);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load opportunities.'));
    return () => {
      live = false;
    };
  }, [fetchAll]);

  const appliedTo = useMemo(() => new Map(apps.map((a) => [a.posting_id, a])), [apps]);
  const shown = useMemo(() => {
    const q = normalise(query);
    const match = (p: OpenPosting) => p.required_skills.filter((s) => passportNames.has(normalise(s))).length;
    return (postings ?? [])
      .filter((p) => !q || [p.title, p.company, p.location, ...p.required_skills].some((f) => normalise(f).includes(q)))
      .sort((a, b) => match(b) - match(a));
  }, [postings, query, passportNames]);
  const upcoming = interviews.filter((i) => i.status === 'scheduled' && Date.parse(i.starts_at) >= now - 3_600_000);

  async function withdraw(a: MyApplication) {
    if (!window.confirm('Withdraw this application? The recruiter will see it as withdrawn.')) return;
    const res = await withdrawApplication(a.id);
    setError(res.error ?? '');
    await reload();
  }

  return (
    <div className="ws-content yg-stack">
      {upcoming.length > 0 && (
        <section className="ws-card">
          <h3 className="ws-card-title">Upcoming interviews</h3>
          <ul className="yg-mini-list">
            {upcoming.map((i) => (
              <li key={i.id} className="yg-mini-row">
                <span>
                  <strong>
                    {i.target_role} · {i.company}
                  </strong>
                  <span className="yg-cell-sub">
                    <CalendarDays size={13} aria-hidden="true" />{' '}
                    {new Date(i.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {i.duration_minutes} min ·{' '}
                    {i.format}
                  </span>
                </span>
                {i.location_or_link &&
                  (/^https?:\/\//i.test(i.location_or_link) ? (
                    <a className="ob-btn-secondary" href={i.location_or_link} target="_blank" rel="noreferrer noopener">
                      <Video size={14} aria-hidden="true" /> Join
                    </a>
                  ) : (
                    <span className="yg-cell-sub">
                      <MapPin size={13} aria-hidden="true" /> {i.location_or_link}
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="yg-review-switch" role="tablist" aria-label="Opportunities">
        <button type="button" role="tab" aria-selected={view === 'roles'} className={view === 'roles' ? 'is-active' : ''} onClick={() => setView('roles')}>
          Open roles{postings ? ` (${postings.length})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'applications'}
          className={view === 'applications' ? 'is-active' : ''}
          onClick={() => setView('applications')}
        >
          My applications{apps.length ? ` (${apps.length})` : ''}
        </button>
      </div>

      {error && (
        <p className="yw-form-error" role="alert">
          {error}
        </p>
      )}

      {view === 'roles' && (
        <>
          <div className="ws-card yg-filter-bar">
            <div className="yg-search">
              <Search size={16} aria-hidden="true" />
              <input
                className="yw-form-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by role, company, skill or city"
                aria-label="Search roles"
              />
            </div>
          </div>
          {!postings && !error && <p className="yg-loading">Loading roles…</p>}
          {postings && shown.length === 0 && (
            <div className="ws-card ws-empty-state">
              <h4 className="ws-empty-title">{postings.length ? 'No roles match your search' : 'No open roles yet'}</h4>
              <p className="ws-empty-desc">Recruiters publish roles here. Meanwhile, founder tasks are a fast way to earn Verified skills.</p>
            </div>
          )}
          <ul className="yg-task-list">
            {shown.map((p) => {
              const mine = appliedTo.get(p.id);
              return (
                <li key={p.id}>
                  <article className="yg-talent-card">
                    <p className="yg-eyebrow">
                      {p.company} · {p.category === 'internship' ? 'Internship' : 'Job'}
                    </p>
                    <h3 className="yg-talent-name">{p.title}</h3>
                    <span className="yg-cell-sub">
                      {[p.work_arrangement, p.location || p.companyLocation, p.experience, p.compensation].filter(Boolean).join(' · ')}
                    </span>
                    <p className="yg-task-summary">{p.description}</p>
                    <div className="yg-pill-row">
                      {p.required_skills.map((s) => (
                        <span key={s} className={`yw-skill-pill ${passportNames.has(normalise(s)) ? 'yw-skill-verified' : 'yw-skill-declared'}`}>
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="yg-invite-row">
                      {mine ? (
                        <span className={`yw-badge ${APP_BADGE[mine.status]}`}>{APPLICATION_LABEL[mine.status]}</span>
                      ) : (
                        <button type="button" className="ob-btn-primary" onClick={() => setApplying(p)}>
                          Apply
                        </button>
                      )}
                      {p.deadline && <span className="yg-cell-sub">Apply by {formatDate(p.deadline)}</span>}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {view === 'applications' &&
        (apps.length === 0 ? (
          <div className="ws-card ws-empty-state">
            <h4 className="ws-empty-title">No applications yet</h4>
            <p className="ws-empty-desc">Apply to an open role and track it here.</p>
          </div>
        ) : (
          <div className="ws-card yg-table-card">
            <table className="ws-table yg-table">
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Applied</th>
                  <th scope="col">
                    <span className="yg-visually-hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.posting?.title ?? 'Role no longer listed'}</strong>
                      {a.posting?.status === 'closed' && <span className="yg-cell-sub">Posting closed</span>}
                    </td>
                    <td>
                      <span className={`yw-badge ${APP_BADGE[a.status]}`}>{APPLICATION_LABEL[a.status]}</span>
                    </td>
                    <td className="yg-nowrap">{formatDate(a.created_at)}</td>
                    <td>
                      {!['withdrawn', 'rejected'].includes(a.status) && (
                        <button type="button" className="ob-inline-link-btn" onClick={() => withdraw(a)}>
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

      {applying && (
        <ApplyModal
          posting={applying}
          onClose={() => setApplying(null)}
          onApply={async (note) => {
            const res = await applyToPosting(userId, applying.id, note);
            if (res.error) return res.error;
            setApplying(null);
            await reload();
            setView('applications');
            return '';
          }}
        />
      )}
    </div>
  );
}

function ApplyModal({ posting, onClose, onApply }: { posting: OpenPosting; onClose: () => void; onApply: (note: string) => Promise<string> }) {
  const uid = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await onApply(note));
    setBusy(false);
  }

  return (
    <div className="yw-modal-overlay" onClick={onClose}>
      <form className="yw-modal-box" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="yw-modal-header">
          <div>
            <p className="yg-eyebrow">{posting.company}</p>
            <h2 className="yw-modal-title" id={`${uid}-t`}>
              Apply: {posting.title}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="yw-modal-body yg-submit-form">
          <p className="ws-card-subtitle">The recruiter sees your name and your Skill Passport, including how each skill was proven.</p>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={`${uid}-note`}>
              Note to the recruiter (optional)
            </label>
            <textarea
              id={`${uid}-note`}
              className="yw-form-textarea"
              rows={4}
              maxLength={3000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this role, and the work that best shows you can do it"
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
              {busy ? 'Sending…' : 'Send application'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
