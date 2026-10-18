import { useCallback, useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { BadgeCheck, Plus, Users, X } from 'lucide-react';
import type { ApplicationStatus, PostingStatus } from '../../lib/database.types';
import {
  EMPTY_POSTING,
  deletePosting,
  listApplicants,
  listMyPostings,
  savePosting,
  setApplicationStatus,
  setPostingStatus,
} from '../../lib/postingData';
import { APPLICATION_LABEL } from '../../lib/postingData';
import type { Applicant, PostingDraft, PostingWithCounts } from '../../lib/postingData';
import { addToPipeline } from '../../lib/recruiterData';
import { formatDate } from '../../seeker-workspace/shared';

const STATUS_BADGE: Record<PostingStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'yw-badge-neutral' },
  open: { label: 'Open', cls: 'yw-badge-green' },
  closed: { label: 'Closed', cls: 'yw-badge-neutral' },
};

interface Props {
  userId: string;
  onChanged?: () => void;
}

/** Roles this recruiter publishes; seekers apply from their Opportunities tab. */
export function PostingsTab({ userId, onChanged }: Props) {
  const [postings, setPostings] = useState<PostingWithCounts[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id?: string; draft: PostingDraft } | null>(null);
  const [viewing, setViewing] = useState<PostingWithCounts | null>(null);

  const reload = useCallback(async () => {
    try {
      setPostings(await listMyPostings(userId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load postings.');
    }
  }, [userId]);

  useEffect(() => {
    let live = true;
    listMyPostings(userId)
      .then((p) => live && setPostings(p))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load postings.'));
    return () => {
      live = false;
    };
  }, [userId]);

  async function changeStatus(p: PostingWithCounts, status: PostingStatus) {
    const res = await setPostingStatus(p.id, status);
    if (res.error) setError(res.error);
    await reload();
  }

  async function remove(p: PostingWithCounts) {
    if (!window.confirm(`Delete "${p.title}"? Its applications are removed too.`)) return;
    const res = await deletePosting(p.id);
    if (res.error) setError(res.error);
    await reload();
  }

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card yg-filter-bar">
        <p className="ws-card-subtitle" style={{ flex: 1, margin: 0 }}>
          Open postings appear in every seeker&apos;s Opportunities tab. Applicants show their Skill Passport, so you can see what was
          verified before you shortlist.
        </p>
        <button type="button" className="ob-btn-primary" onClick={() => setEditing({ draft: { ...EMPTY_POSTING } })}>
          <Plus size={16} aria-hidden="true" />
          <span>New posting</span>
        </button>
      </div>

      {error && (
        <p className="yw-alert yw-alert-danger" role="alert">
          {error}
        </p>
      )}
      {!postings && !error && <p className="yg-loading">Loading postings…</p>}
      {postings && postings.length === 0 && (
        <div className="ws-card ws-empty-state">
          <h4 className="ws-empty-title">No postings yet</h4>
          <p className="ws-empty-desc">Publish a role to start receiving applications from seekers with proven skills.</p>
        </div>
      )}
      {postings && postings.length > 0 && (
        <ul className="yg-task-list">
          {postings.map((p) => (
            <li key={p.id}>
              <article className="yg-talent-card">
                <div className="yg-talent-head">
                  <div>
                    <p className="yg-eyebrow">{p.category === 'internship' ? 'Internship' : 'Job'} · {p.work_arrangement}</p>
                    <h3 className="yg-talent-name">{p.title}</h3>
                    <span className="yg-cell-sub">
                      {[p.location, p.compensation, p.deadline ? `Apply by ${formatDate(p.deadline)}` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span className={`yw-badge ${STATUS_BADGE[p.status].cls}`}>{STATUS_BADGE[p.status].label}</span>
                </div>
                <div className="yg-pill-row">
                  {p.required_skills.map((s) => (
                    <span key={s} className="yw-skill-pill yw-skill-declared">
                      {s}
                    </span>
                  ))}
                </div>
                <div className="yg-talent-counts">
                  <span>
                    <strong>{p.applicants}</strong> applicants
                  </span>
                  {p.newApplicants > 0 && (
                    <span>
                      <strong>{p.newApplicants}</strong> new
                    </span>
                  )}
                </div>
                <div className="yg-invite-row">
                  <button type="button" className="ob-btn-primary" onClick={() => setViewing(p)} disabled={!p.applicants}>
                    <Users size={15} aria-hidden="true" />
                    <span>Applicants</span>
                  </button>
                  <button
                    type="button"
                    className="ob-btn-secondary"
                    onClick={() =>
                      setEditing({
                        id: p.id,
                        draft: {
                          title: p.title,
                          category: p.category,
                          description: p.description,
                          required_skills: p.required_skills,
                          experience: p.experience,
                          work_arrangement: p.work_arrangement,
                          location: p.location,
                          compensation: p.compensation,
                          deadline: p.deadline,
                          status: p.status,
                        },
                      })
                    }
                  >
                    Edit
                  </button>
                  {p.status !== 'open' ? (
                    <button type="button" className="ob-inline-link-btn" onClick={() => changeStatus(p, 'open')}>
                      Publish
                    </button>
                  ) : (
                    <button type="button" className="ob-inline-link-btn" onClick={() => changeStatus(p, 'closed')}>
                      Close
                    </button>
                  )}
                  <button type="button" className="ob-inline-link-btn" onClick={() => remove(p)}>
                    Delete
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <PostingForm
          id={editing.id}
          initial={editing.draft}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            const res = await savePosting(userId, draft, editing.id);
            if (res.error) return res.error;
            setEditing(null);
            await reload();
            return '';
          }}
        />
      )}
      {viewing && (
        <ApplicantsModal
          posting={viewing}
          onClose={() => {
            setViewing(null);
            void reload();
          }}
          onPipelineChanged={onChanged}
        />
      )}
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

function PostingForm({
  id,
  initial,
  onClose,
  onSave,
}: {
  id?: string;
  initial: PostingDraft;
  onClose: () => void;
  onSave: (d: PostingDraft) => Promise<string>;
}) {
  const uid = useId();
  const [d, setD] = useState<PostingDraft>(initial);
  const [skills, setSkills] = useState(initial.required_skills.join(', '));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEscape(onClose);
  const set = <K extends keyof PostingDraft>(k: K, v: PostingDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent, status: PostingStatus) {
    e.preventDefault();
    if (d.title.trim().length < 2) return setError('Add a role title.');
    if (status === 'open' && d.description.trim().length < 30) return setError('Describe the role in a few sentences before publishing.');
    setBusy(true);
    const err = await onSave({
      ...d,
      status,
      required_skills: [...new Set(skills.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 15),
    });
    setBusy(false);
    setError(err);
  }

  const field = (key: string) => `${uid}-${key}`;
  return (
    <div className="yw-modal-overlay" onClick={onClose}>
      <form
        className="yw-modal-box yg-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby={field('title-h')}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => submit(e, 'open')}
        noValidate
      >
        <div className="yw-modal-header">
          <h2 className="yw-modal-title" id={field('title-h')}>
            {id ? 'Edit posting' : 'New posting'}
          </h2>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="yw-modal-body yg-submit-form">
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={field('title')}>
              Role title
            </label>
            <input id={field('title')} className="yw-form-input" maxLength={140} value={d.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="yg-inline-form" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor={field('cat')}>
                Type
              </label>
              <select id={field('cat')} className="yw-form-select" value={d.category} onChange={(e) => set('category', e.target.value)}>
                <option value="job">Job</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor={field('arr')}>
                Work arrangement
              </label>
              <select id={field('arr')} className="yw-form-select" value={d.work_arrangement} onChange={(e) => set('work_arrangement', e.target.value)}>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on-site">On-site</option>
              </select>
            </div>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor={field('deadline')}>
                Apply by (optional)
              </label>
              <input
                id={field('deadline')}
                className="yw-form-input"
                type="date"
                value={d.deadline ?? ''}
                onChange={(e) => set('deadline', e.target.value || null)}
              />
            </div>
          </div>
          <div className="yg-inline-form" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor={field('loc')}>
                Location
              </label>
              <input id={field('loc')} className="yw-form-input" value={d.location} onChange={(e) => set('location', e.target.value)} placeholder="Bengaluru" />
            </div>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor={field('exp')}>
                Experience
              </label>
              <input id={field('exp')} className="yw-form-input" value={d.experience} onChange={(e) => set('experience', e.target.value)} placeholder="0-2 years" />
            </div>
            <div className="yw-form-group">
              <label className="yw-form-label" htmlFor={field('pay')}>
                Compensation
              </label>
              <input
                id={field('pay')}
                className="yw-form-input"
                maxLength={120}
                value={d.compensation}
                onChange={(e) => set('compensation', e.target.value)}
                placeholder="₹8-12 LPA"
              />
            </div>
          </div>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={field('skills')}>
              Required skills (comma separated)
            </label>
            <input
              id={field('skills')}
              className="yw-form-input"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="React, TypeScript, SQL"
            />
          </div>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={field('desc')}>
              Description
            </label>
            <textarea
              id={field('desc')}
              className="yw-form-textarea"
              rows={6}
              maxLength={6000}
              value={d.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What the person will do, the team, and what good looks like after 90 days"
            />
          </div>
          {error && (
            <p className="yw-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="yg-form-actions">
            <button type="button" className="ob-btn-secondary" disabled={busy} onClick={(e) => submit(e, 'draft')}>
              Save as draft
            </button>
            <button type="submit" className="ob-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Publish'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ApplicantsModal({
  posting,
  onClose,
  onPipelineChanged,
}: {
  posting: PostingWithCounts;
  onClose: () => void;
  onPipelineChanged?: () => void;
}) {
  const uid = useId();
  const [list, setList] = useState<Applicant[] | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEscape(onClose);

  const reload = useCallback(async () => {
    try {
      setList(await listApplicants(posting.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load applicants.');
    }
  }, [posting.id]);

  useEffect(() => {
    let live = true;
    listApplicants(posting.id)
      .then((l) => live && setList(l))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load applicants.'));
    return () => {
      live = false;
    };
  }, [posting.id]);

  async function move(a: Applicant, status: Exclude<ApplicationStatus, 'withdrawn'>) {
    const res = await setApplicationStatus(a.id, status);
    if (res.error) setError(res.error);
    await reload();
  }

  async function shortlist(a: Applicant) {
    const res = await addToPipeline(
      a.seeker_id,
      posting.title,
      'screening',
      a.skills.filter((s) => s.level === 'verified').map((s) => s.skill_name),
    );
    if (res.error) return setError(res.error);
    if (a.status === 'applied') await setApplicationStatus(a.id, 'in_review');
    setNotice(`${a.name} is in your pipeline for ${posting.title}.`);
    onPipelineChanged?.();
    await reload();
  }

  return (
    <div className="yw-modal-overlay" onClick={onClose}>
      <div className="yw-modal-box yg-modal-wide" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={(e) => e.stopPropagation()}>
        <div className="yw-modal-header">
          <div>
            <p className="yg-eyebrow">Applicants</p>
            <h2 className="yw-modal-title" id={`${uid}-t`}>
              {posting.title}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="yw-modal-body yg-stack">
          {error && (
            <p className="yw-form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="yg-done" role="status">
              {notice}
            </p>
          )}
          {!list && !error && <p className="yg-loading">Loading applicants…</p>}
          {list?.length === 0 && <p className="ws-card-subtitle">No applications yet.</p>}
          {list?.map((a) => (
            <article key={a.id} className="ws-card yg-invite-card">
              <div className="yg-talent-head">
                <div>
                  <h3 className="yg-talent-name">{a.name}</h3>
                  <span className="yg-cell-sub">Applied {formatDate(a.created_at)}</span>
                </div>
                <select
                  className="yw-form-select"
                  style={{ width: 'auto' }}
                  value={a.status}
                  aria-label={`Status for ${a.name}`}
                  onChange={(e) => move(a, e.target.value as Exclude<ApplicationStatus, 'withdrawn'>)}
                >
                  {(['applied', 'in_review', 'interview', 'offer', 'rejected'] as const).map((s) => (
                    <option key={s} value={s}>
                      {APPLICATION_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="yg-pill-row" aria-label="Skill Passport">
                {a.skills.length === 0 && <span className="yg-muted">No skills on their passport yet.</span>}
                {a.skills.map((s) => (
                  <span key={s.skill_name} className={`yw-skill-pill yw-skill-${s.level}`}>
                    {s.level === 'verified' && <BadgeCheck size={13} aria-hidden="true" />}
                    {s.skill_name}
                  </span>
                ))}
              </div>
              {a.cover_note && <p className="yg-feedback">“{a.cover_note}”</p>}
              <div className="yg-form-actions">
                <button type="button" className="ob-btn-secondary" onClick={() => shortlist(a)}>
                  Add to pipeline
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
