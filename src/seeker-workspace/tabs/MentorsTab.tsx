import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Circle, Search, Video, X } from 'lucide-react';
import {
  listMentors,
  listMyMentoring,
  requestMentorship,
  toggleActionItem,
  withdrawMentorshipRequest,
} from '../../lib/seekerGrowth';
import type { ListedMentor, MyMentorship } from '../../lib/seekerGrowth';
import type { MentorshipRequest } from '../../lib/database.types';
import { formatDate, normalise } from '../shared';

interface Props {
  userId: string;
  mySkills: string[];
  careerGoal: string;
}

type View = 'mine' | 'find';
type Mentoring = Awaited<ReturnType<typeof listMyMentoring>>;

const REQUEST_BADGE: Record<MentorshipRequest['status'], { label: string; cls: string }> = {
  pending: { label: 'Waiting for reply', cls: 'yw-badge-amber' },
  accepted: { label: 'Accepted', cls: 'yw-badge-green' },
  declined: { label: 'Declined', cls: 'yw-badge-neutral' },
  withdrawn: { label: 'Withdrawn', cls: 'yw-badge-neutral' },
};

export function MentorsTab({ userId, mySkills, careerGoal }: Props) {
  const [view, setView] = useState<View>('mine');
  const [mentors, setMentors] = useState<ListedMentor[] | null>(null);
  const [mine, setMine] = useState<Mentoring | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState<ListedMentor | null>(null);

  const fetchAll = useCallback(() => Promise.all([listMentors(), listMyMentoring(userId)]), [userId]);
  const reload = useCallback(async () => {
    try {
      const [m, s] = await fetchAll();
      setMentors(m);
      setMine(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load mentors.');
    }
  }, [fetchAll]);

  useEffect(() => {
    let live = true;
    fetchAll()
      .then(([m, s]) => {
        if (!live) return;
        setMentors(m);
        setMine(s);
        if (!s.mentorships.length && !s.requests.length) setView('find');
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load mentors.'));
    return () => {
      live = false;
    };
  }, [fetchAll]);

  const pendingWith = new Set((mine?.requests ?? []).filter((r) => r.status === 'pending').map((r) => r.mentor_id));
  const mentoredBy = new Set((mine?.mentorships ?? []).filter((m) => m.status !== 'completed').map((m) => m.mentor_id));
  const shown = useMemo(() => {
    const q = normalise(query);
    return (mentors ?? []).filter(
      (m) =>
        !q ||
        [m.name, m.headline, m.role_title, m.organization ?? '', ...m.expertise_areas, ...m.technical_skills, ...m.tracks].some((f) =>
          normalise(f).includes(q),
        ),
    );
  }, [mentors, query]);

  async function act(p: Promise<{ error?: string }>) {
    const res = await p;
    setError(res.error ?? '');
    await reload();
  }

  return (
    <div className="ws-content yg-stack">
      <div className="yg-review-switch" role="tablist" aria-label="Mentors">
        <button type="button" role="tab" aria-selected={view === 'mine'} className={view === 'mine' ? 'is-active' : ''} onClick={() => setView('mine')}>
          My mentoring{mine?.mentorships.length ? ` (${mine.mentorships.length})` : ''}
        </button>
        <button type="button" role="tab" aria-selected={view === 'find'} className={view === 'find' ? 'is-active' : ''} onClick={() => setView('find')}>
          Find a mentor
        </button>
      </div>

      {error && (
        <p className="yw-form-error" role="alert">
          {error}
        </p>
      )}
      {!mine && !error && <p className="yg-loading">Loading mentors…</p>}

      {view === 'mine' && mine && (
        <>
          {mine.mentorships.length === 0 && mine.requests.length === 0 && (
            <div className="ws-card ws-empty-state">
              <h4 className="ws-empty-title">No mentors yet</h4>
              <p className="ws-empty-desc">Ask an experienced mentor for guidance on a track you care about.</p>
              <button type="button" className="ob-btn-primary" onClick={() => setView('find')}>
                Find a mentor
              </button>
            </div>
          )}
          {mine.mentorships.map((m) => (
            <MentorshipCard key={m.id} m={m} onToggle={(item) => act(toggleActionItem(item))} />
          ))}
          {mine.requests.length > 0 && (
            <section className="ws-card">
              <h3 className="ws-card-title">Requests</h3>
              <ul className="yg-mini-list">
                {mine.requests.map((r) => (
                  <li key={r.id} className="yg-mini-row">
                    <span>
                      <strong>
                        {r.mentorName} · {r.track}
                      </strong>
                      <span className="yg-cell-sub">
                        Sent {formatDate(r.created_at)}
                        {r.response_note ? ` · “${r.response_note}”` : ''}
                      </span>
                    </span>
                    <span className="yg-skill-actions">
                      <span className={`yw-badge ${REQUEST_BADGE[r.status].cls}`}>{REQUEST_BADGE[r.status].label}</span>
                      {r.status === 'pending' && (
                        <button type="button" className="ob-inline-link-btn" onClick={() => act(withdrawMentorshipRequest(r.id))}>
                          Withdraw
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {view === 'find' && (
        <>
          <div className="ws-card yg-filter-bar">
            <div className="yg-search">
              <Search size={16} aria-hidden="true" />
              <input
                className="yw-form-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by skill, track, company or name"
                aria-label="Search mentors"
              />
            </div>
          </div>
          {mentors && shown.length === 0 && (
            <div className="ws-card ws-empty-state">
              <h4 className="ws-empty-title">{mentors.length ? 'No mentors match your search' : 'No mentors listed yet'}</h4>
              <p className="ws-empty-desc">Approved mentors appear here once they finish their profile.</p>
            </div>
          )}
          <ul className="yg-task-list">
            {shown.map((m) => (
              <li key={m.id}>
                <article className="yg-talent-card">
                  <p className="yg-eyebrow">{[m.role_title, m.organization].filter(Boolean).join(' · ') || 'Mentor'}</p>
                  <h3 className="yg-talent-name">{m.name}</h3>
                  {m.headline && <span className="yg-cell-sub">{m.headline}</span>}
                  {m.bio && <p className="yg-task-summary">{m.bio}</p>}
                  <div className="yg-pill-row" aria-label="Expertise">
                    {[...m.expertise_areas, ...m.technical_skills].slice(0, 8).map((s) => (
                      <span key={s} className="yw-skill-pill yw-skill-declared">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="yg-talent-counts">
                    <span>{m.session_minutes} min sessions</span>
                    <span>{m.session_frequency}</span>
                    <span>{m.pricing === 'free' ? 'Free' : m.pricing === 'paid' ? m.hourly_rate || 'Paid' : 'Scholarship'}</span>
                  </div>
                  <div className="yg-invite-row">
                    {mentoredBy.has(m.id) ? (
                      <span className="yw-badge yw-badge-green">Your mentor</span>
                    ) : pendingWith.has(m.id) ? (
                      <span className="yw-badge yw-badge-amber">Request sent</span>
                    ) : !m.accepting ? (
                      <span className="yw-badge yw-badge-neutral">Not taking requests</span>
                    ) : (
                      <button type="button" className="ob-btn-primary" onClick={() => setAsking(m)}>
                        Request mentorship
                      </button>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}

      {asking && (
        <RequestModal
          mentor={asking}
          defaultGoal={careerGoal}
          mySkills={mySkills}
          onClose={() => setAsking(null)}
          onSend={async (r) => {
            const res = await requestMentorship(userId, asking.id, r);
            if (res.error) return res.error;
            setAsking(null);
            await reload();
            setView('mine');
            return '';
          }}
        />
      )}
    </div>
  );
}

function MentorshipCard({ m, onToggle }: { m: MyMentorship; onToggle: (item: MyMentorship['actionItems'][number]) => void }) {
  const [now] = useState(Date.now);
  const upcoming = m.sessions.filter((s) => s.status === 'scheduled' && Date.parse(s.starts_at) >= now - 3_600_000);
  const past = m.sessions.filter((s) => s.status === 'completed').reverse();
  return (
    <article className="ws-card yg-stack">
      <div className="yg-talent-head">
        <div>
          <p className="yg-eyebrow">
            {m.track} · since {formatDate(m.started_at)}
          </p>
          <h3 className="yg-talent-name">{m.mentorName}</h3>
          {m.career_goal && <span className="yg-cell-sub">Goal: {m.career_goal}</span>}
        </div>
        <span className={`yw-badge ${m.status === 'active' ? 'yw-badge-green' : 'yw-badge-neutral'}`}>
          {m.status === 'on_hold' ? 'On hold' : m.status === 'active' ? 'Active' : 'Completed'}
        </span>
      </div>

      {m.goals.length > 0 && (
        <div className="yg-pill-row" aria-label="Goals">
          {m.goals.map((g) => (
            <span key={g} className="yw-skill-pill yw-skill-assessed">
              {g}
            </span>
          ))}
        </div>
      )}

      <div className="yg-two-col">
        <section>
          <h4 className="yg-form-title">Sessions</h4>
          {upcoming.length === 0 && past.length === 0 && <p className="ws-card-subtitle">Your mentor will schedule your first session.</p>}
          <ul className="yg-mini-list">
            {upcoming.map((s) => (
              <li key={s.id} className="yg-mini-row">
                <span>
                  <strong>{s.title}</strong>
                  <span className="yg-cell-sub">
                    <CalendarDays size={13} aria-hidden="true" />{' '}
                    {new Date(s.starts_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {s.duration_minutes} min
                  </span>
                </span>
                {s.meeting_link && (
                  <a className="ob-btn-secondary" href={s.meeting_link} target="_blank" rel="noreferrer noopener">
                    <Video size={14} aria-hidden="true" /> Join
                  </a>
                )}
              </li>
            ))}
            {past.slice(0, 3).map((s) => (
              <li key={s.id} className="yg-mini-row">
                <span>
                  <strong>{s.title}</strong>
                  <span className="yg-cell-sub">
                    {formatDate(s.starts_at)}
                    {s.summary ? ` · ${s.summary}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="yg-form-title">Action items</h4>
          {m.actionItems.length === 0 && <p className="ws-card-subtitle">Nothing assigned yet.</p>}
          <ul className="yg-roadmap">
            {m.actionItems.map((i) => (
              <li key={i.id} className={i.completed ? 'is-done' : ''}>
                <button type="button" className="yg-icon-btn" onClick={() => onToggle(i)} aria-label={i.completed ? `Reopen "${i.text}"` : `Mark "${i.text}" done`}>
                  {i.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div>
                  <strong>{i.text}</strong>
                  {i.due_date && <p className="ws-card-subtitle">Due {formatDate(i.due_date)}</p>}
                </div>
                <span />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {m.feedback.length > 0 && (
        <section>
          <h4 className="yg-form-title">Feedback from your mentor</h4>
          {m.feedback.map((f) => (
            <div key={f.id} className="yg-feedback-block">
              <p className="yg-eyebrow">{formatDate(f.created_at)}</p>
              {f.strengths && (
                <p>
                  <strong>Strengths:</strong> {f.strengths}
                </p>
              )}
              {f.improvements && (
                <p>
                  <strong>To work on:</strong> {f.improvements}
                </p>
              )}
              {f.next_steps && (
                <p>
                  <strong>Next steps:</strong> {f.next_steps}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </article>
  );
}

function RequestModal({
  mentor,
  defaultGoal,
  mySkills,
  onClose,
  onSend,
}: {
  mentor: ListedMentor;
  defaultGoal: string;
  mySkills: string[];
  onClose: () => void;
  onSend: (r: { track: string; careerGoal: string; skills: string[]; message: string; preferredTime: string }) => Promise<string>;
}) {
  const uid = useId();
  const [track, setTrack] = useState(mentor.tracks[0] ?? '');
  const [goal, setGoal] = useState(defaultGoal);
  const [message, setMessage] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!track.trim()) return setError('Choose a track.');
    if (message.trim().length < 20) return setError('Write at least a couple of sentences about what you want help with.');
    setBusy(true);
    setError(await onSend({ track: track.trim(), careerGoal: goal, skills: mySkills.slice(0, 10), message, preferredTime: time }));
    setBusy(false);
  }

  return (
    <div className="yw-modal-overlay" onClick={onClose}>
      <form className="yw-modal-box yg-modal-wide" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <div className="yw-modal-header">
          <div>
            <p className="yg-eyebrow">Mentorship request</p>
            <h2 className="yw-modal-title" id={`${uid}-t`}>
              Ask {mentor.name}
            </h2>
          </div>
          <button type="button" className="yw-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="yw-modal-body yg-submit-form">
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={`${uid}-track`}>
              Track
            </label>
            {mentor.tracks.length ? (
              <select id={`${uid}-track`} className="yw-form-select" value={track} onChange={(e) => setTrack(e.target.value)}>
                {mentor.tracks.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            ) : (
              <input id={`${uid}-track`} className="yw-form-input" value={track} onChange={(e) => setTrack(e.target.value)} />
            )}
          </div>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={`${uid}-goal`}>
              Career goal
            </label>
            <input id={`${uid}-goal`} className="yw-form-input" maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Frontend engineer at a product startup" />
          </div>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={`${uid}-msg`}>
              Message
            </label>
            <textarea
              id={`${uid}-msg`}
              className="yw-form-textarea"
              rows={5}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Where you are now, what you want to get better at, and why this mentor"
            />
          </div>
          <div className="yw-form-group">
            <label className="yw-form-label" htmlFor={`${uid}-time`}>
              Times that suit you (optional)
            </label>
            <input id={`${uid}-time`} className="yw-form-input" maxLength={120} value={time} onChange={(e) => setTime(e.target.value)} placeholder="Weekday evenings after 7 pm IST" />
          </div>
          <p className="ws-card-subtitle">The mentor sees your name, this message and your Skill Passport.</p>
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
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
