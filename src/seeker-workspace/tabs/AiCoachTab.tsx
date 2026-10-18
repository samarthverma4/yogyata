import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import { ai, AiError } from '../../lib/aiClient';
import type {
  AiRoadmap,
  AiRole,
  AssistantReply,
  InterviewEvaluation,
  InterviewQuestion,
  Matches,
  ResumeResult,
} from '../../lib/aiClient';
import { declareSkill } from '../../lib/seekerData';
import { importRoadmapSteps } from '../../lib/seekerGrowth';
import type { SeekerTab } from '../shared';
import { normalise } from '../shared';

type View = 'readiness' | 'roadmap' | 'matches' | 'interview' | 'resume' | 'assistant';

const VIEWS: { id: View; label: string }[] = [
  { id: 'readiness', label: 'Readiness' },
  { id: 'roadmap', label: 'AI roadmap' },
  { id: 'matches', label: 'Matches' },
  { id: 'interview', label: 'Mock interview' },
  { id: 'resume', label: 'Resume check' },
  { id: 'assistant', label: 'Assistant' },
];

const STATUS_LABEL: Record<string, string> = {
  met: 'Met',
  unassessed: 'Unknown yet',
  declared_only: 'Declared only',
  demonstrated_weakness: 'Needs work',
  partial: 'Partly shown',
};

interface Props {
  userId: string;
  passportNames: Set<string>;
  onNavigate: (tab: SeekerTab) => void;
  /** Called after the coach adds skills or roadmap steps, so other tabs refresh. */
  onChanged: () => Promise<void>;
}

const errText = (e: unknown) => (e instanceof AiError || e instanceof Error ? e.message : 'Something went wrong.');

/** Guidance from the yogyata-ai package (Riddhima's branch). Advice only: it never applies, books or changes a skill level. */
export function AiCoachTab({ userId, passportNames, onNavigate, onChanged }: Props) {
  const [view, setView] = useState<View>('readiness');
  const [roles, setRoles] = useState<AiRole[]>([]);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    ai.roles()
      .then((r) => live && setRoles(r))
      .catch((e: unknown) => live && setError(errText(e)));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card yg-filter-bar">
        <p className="ws-card-subtitle" style={{ flex: 1, margin: 0 }}>
          <Sparkles size={15} aria-hidden="true" /> Suggestions from Yogyata AI, based on your Skill Passport. Scores guide what to work on next; they
          are not a prediction of being hired.
        </p>
        <label className="yg-check">
          <span>Target role</span>
          <select className="yw-form-select" style={{ width: 'auto' }} value={role ?? ''} onChange={(e) => setRole(e.target.value || undefined)}>
            <option value="">From my career goal</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="yg-review-switch" role="tablist" aria-label="AI coach">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={view === v.id ? 'is-active' : ''} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="yw-alert yw-alert-danger" role="alert">
          {error}
        </p>
      )}

      {view === 'readiness' && <ReadinessView role={role} />}
      {view === 'roadmap' && <RoadmapView role={role} onSaved={onChanged} onOpenRoadmap={() => onNavigate('roadmap')} />}
      {view === 'matches' && <MatchesView role={role} passportNames={passportNames} onNavigate={onNavigate} />}
      {view === 'interview' && <InterviewView role={role} />}
      {view === 'resume' && <ResumeView userId={userId} role={role} passportNames={passportNames} onChanged={onChanged} />}
      {view === 'assistant' && <AssistantView role={role} onSaved={onChanged} />}
    </div>
  );
}

/** Loads once per `key` (the target role); a result for an older key is not shown. */
function useAi<T>(key: string, load: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; data: T | null; error: string } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let live = true;
    loadRef
      .current()
      .then((data) => live && setState({ key, data, error: '' }))
      .catch((e: unknown) => live && setState({ key, data: null, error: errText(e) }));
    return () => {
      live = false;
    };
  }, [key]);
  const current = state?.key === key ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? '' };
}

function Problem({ text }: { text: string }) {
  return (
    <p className="yw-alert yw-alert-danger" role="alert">
      {text}
    </p>
  );
}

function ReadinessView({ role }: { role?: string }) {
  const { data, error } = useAi(role ?? '', () => ai.readiness(role));
  if (error) return <Problem text={error} />;
  if (!data) return <p className="yg-loading">Checking your readiness…</p>;
  return (
    <>
      <div className="ws-card">
        <div className="yg-talent-head">
          <div>
            <p className="yg-eyebrow">{data.role_title}</p>
            <h3 className="yg-talent-name">Readiness {Math.round(data.readiness_score)}/100</h3>
            <span className="yg-cell-sub">
              Could be anywhere from {Math.round(data.readiness_min)} to {Math.round(data.readiness_max)} until unknown skills are assessed.
            </span>
          </div>
          <strong className="yg-big-num">{Math.round(data.readiness_score)}</strong>
        </div>
        <div className="yg-progress" aria-hidden="true">
          <span style={{ width: `${data.readiness_score}%` }} />
        </div>
        <p className="ws-card-subtitle">{data.score_meaning}</p>
      </div>
      <section className="ws-card">
        <h3 className="ws-card-title">Work on next</h3>
        <ul className="yg-roadmap">
          {data.priority_gaps.slice(0, 6).map((g) => (
            <li key={g.skill}>
              <span className="yw-skill-pill yw-skill-declared">{g.skill}</span>
              <div>
                <p className="yg-eyebrow">
                  {STATUS_LABEL[g.status] ?? g.status} · importance {g.importance}/5
                </p>
                <p className="ws-card-subtitle">{g.explanation}</p>
              </div>
              <span />
            </li>
          ))}
        </ul>
      </section>
      {data.met.length > 0 && (
        <section className="ws-card">
          <h3 className="ws-card-title">Already shown</h3>
          <div className="yg-pill-row">
            {data.met.map((s) => (
              <span key={s} className="yw-skill-pill yw-skill-verified">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function RoadmapView({ role, onSaved, onOpenRoadmap }: { role?: string; onSaved: () => Promise<void>; onOpenRoadmap: () => void }) {
  const [hours, setHours] = useState(6);
  const [weeks, setWeeks] = useState(8);
  const [plan, setPlan] = useState<AiRoadmap | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function make(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      setPlan(await ai.roadmap(role, hours, weeks));
      setError('');
    } catch (err) {
      setError(errText(err));
    }
    setBusy(false);
  }

  async function save() {
    if (!plan) return;
    const res = await importRoadmapSteps(
      plan.items.map((i) => ({
        title: i.title,
        description: i.objective,
        type: i.type,
        weeks: i.start_week ? `weeks ${i.start_week}-${i.end_week}` : undefined,
      })),
    );
    if (res.error) setError(res.error);
    else {
      setSaved(true);
      await onSaved();
    }
  }

  return (
    <>
      <form className="ws-card yg-inline-form" style={{ gridTemplateColumns: '1fr 1fr auto' }} onSubmit={make}>
        <div className="yw-form-group">
          <label className="yw-form-label" htmlFor="ai-hours">
            Hours per week
          </label>
          <input id="ai-hours" className="yw-form-input" type="number" min={1} max={60} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} />
        </div>
        <div className="yw-form-group">
          <label className="yw-form-label" htmlFor="ai-weeks">
            Weeks
          </label>
          <input id="ai-weeks" className="yw-form-input" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} />
        </div>
        <button type="submit" className="ob-btn-primary" disabled={busy}>
          {busy ? 'Planning…' : 'Plan my weeks'}
        </button>
      </form>
      {error && <Problem text={error} />}
      {plan && (
        <section className="ws-card yg-stack">
          <div className="yg-talent-head">
            <div>
              <p className="yg-eyebrow">{plan.role_title}</p>
              <h3 className="yg-talent-name">
                {plan.items.length} steps · {Math.round(plan.total_hours)} hours
              </h3>
              <span className="yg-cell-sub">
                {plan.schedule.projected_completion_week
                  ? `At ${hours} h a week you finish around week ${plan.schedule.projected_completion_week}.`
                  : 'Fits your weeks.'}
              </span>
            </div>
            {saved ? (
              <button type="button" className="ob-btn-secondary" onClick={onOpenRoadmap}>
                Open my roadmap
              </button>
            ) : (
              <button type="button" className="ob-btn-primary" onClick={save}>
                Add to my roadmap
              </button>
            )}
          </div>
          <ol className="yg-roadmap">
            {plan.items.map((i) => (
              <li key={i.order}>
                <span className="yg-count">{i.order}</span>
                <div>
                  <p className="yg-eyebrow">
                    {i.skill} · {i.type} · {i.hours} h{i.start_week ? ` · weeks ${i.start_week}-${i.end_week}` : ' · after this plan'}
                  </p>
                  <strong>{i.title}</strong>
                  <p className="ws-card-subtitle">{i.reason}</p>
                </div>
                <span />
              </li>
            ))}
          </ol>
          {plan.disclaimer && <p className="ws-card-subtitle">{plan.disclaimer}</p>}
        </section>
      )}
    </>
  );
}

function MatchesView({ role, passportNames, onNavigate }: { role?: string; passportNames: Set<string>; onNavigate: (t: SeekerTab) => void }) {
  const { data, error } = useAi<Matches>(role ?? '', () => ai.matches(role));
  if (error) return <Problem text={error} />;
  if (!data) return <p className="yg-loading">Ranking roles, tasks and mentors…</p>;
  const ranked = data.opportunities.ranked;
  return (
    <>
      <section className="ws-card">
        <h3 className="ws-card-title">Roles and founder tasks that fit</h3>
        {ranked.length === 0 && <p className="ws-card-subtitle">No open roles or tasks to rank yet.</p>}
        <ul className="yg-mini-list">
          {ranked.map((o) => (
            <li key={o.opportunity_id} className="yg-mini-row">
              <span>
                <strong>
                  {o.title} <span className="yg-cell-sub">({o.type === 'startup_task' ? 'founder task' : o.type})</span>
                </strong>
                <span className="yg-cell-sub">{o.explanation.join(' ')}</span>
                <span className="yg-pill-row">
                  {o.missing_skills.map((s) => (
                    <span key={s} className={`yw-skill-pill ${passportNames.has(normalise(s)) ? 'yw-skill-assessed' : 'yw-skill-declared'}`}>
                      missing: {s}
                    </span>
                  ))}
                </span>
              </span>
              <span className="yg-skill-actions">
                <strong>{Math.round(o.score)}</strong>
                <button
                  type="button"
                  className="ob-inline-link-btn"
                  onClick={() => onNavigate(o.opportunity_id.startsWith('task:') ? 'tasks' : 'opportunities')}
                >
                  Open
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="ws-card">
        <h3 className="ws-card-title">Mentors for your gaps</h3>
        {data.mentors.ranked.length === 0 && <p className="ws-card-subtitle">No listed mentor covers your current gaps yet.</p>}
        <ul className="yg-mini-list">
          {data.mentors.ranked.map((m) => (
            <li key={m.mentor_id} className="yg-mini-row">
              <span>
                <strong>Covers {m.matched_skills.map((s) => s.skill).join(', ')}</strong>
                <span className="yg-cell-sub">{m.reasons.slice(0, 2).join(' ')}</span>
              </span>
              <button type="button" className="ob-inline-link-btn" onClick={() => onNavigate('mentors')}>
                Find in Mentors
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function InterviewView({ role }: { role?: string }) {
  const [kind, setKind] = useState('technical');
  const [asked, setAsked] = useState<string[]>([]);
  const [q, setQ] = useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<InterviewEvaluation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function next(history = asked) {
    setBusy(true);
    setResult(null);
    setAnswer('');
    try {
      setQ(await ai.nextQuestion(role, kind, history));
      setError('');
    } catch (e) {
      setError(errText(e));
    }
    setBusy(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!q?.question || !answer.trim()) return;
    setBusy(true);
    try {
      setResult(await ai.evaluate(q.question.id, answer));
      setAsked((a) => [...a, q.question!.id]);
      setError('');
    } catch (err) {
      setError(errText(err));
    }
    setBusy(false);
  }

  return (
    <section className="ws-card yg-stack">
      <div className="yg-filter-bar">
        <label className="yg-check">
          <span>Type</span>
          <select className="yw-form-select" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="technical">Technical</option>
            <option value="behavioral">Behavioural</option>
            <option value="hr">HR</option>
          </select>
        </label>
        <button type="button" className="ob-btn-primary" onClick={() => next()} disabled={busy}>
          {q ? 'Next question' : 'Start practice'}
        </button>
        {asked.length > 0 && <span className="yg-cell-sub">{asked.length} answered this session</span>}
      </div>
      {error && <Problem text={error} />}
      {q && !q.question && <p className="ws-card-subtitle">{q.reason}</p>}
      {q?.question && (
        <form className="yg-submit-form" onSubmit={submit}>
          <p className="yg-eyebrow">
            {q.question.topic} · level {q.question.difficulty}
          </p>
          <h3 className="yg-form-title">{q.question.text}</h3>
          <textarea
            className="yw-form-textarea"
            rows={6}
            maxLength={6000}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer as you would out loud: what, why, and a concrete example"
            aria-label="Your answer"
            disabled={Boolean(result)}
          />
          {!result && (
            <div className="yg-form-actions">
              <button type="submit" className="ob-btn-primary" disabled={busy || !answer.trim()}>
                {busy ? 'Scoring…' : 'Get feedback'}
              </button>
            </div>
          )}
        </form>
      )}
      {result && (
        <div className="yg-feedback-block">
          <p className="yg-eyebrow">
            Score {Math.round(result.evaluation.overall)}/100 · confidence {result.evaluation.confidence}
          </p>
          {result.evaluation.strengths.length > 0 && (
            <p>
              <strong>Good:</strong> {result.evaluation.strengths.join(' ')}
            </p>
          )}
          {result.evaluation.improvements.length > 0 && (
            <p>
              <strong>Improve:</strong> {result.evaluation.improvements.join(' ')}
            </p>
          )}
          <p className="ws-card-subtitle">Practice feedback only: it does not change your Skill Passport.</p>
        </div>
      )}
    </section>
  );
}

function ResumeView({ userId, role, passportNames, onChanged }: { userId: string; role?: string; passportNames: Set<string>; onChanged: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [res, setRes] = useState<ResumeResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAdded(0);
    try {
      setRes(await ai.resume(text, role));
      setError('');
    } catch (err) {
      setError(errText(err));
    }
    setBusy(false);
  }

  const newSkills = (res?.analysis.parsed.skills ?? []).filter((s) => !passportNames.has(normalise(s.name)));

  async function addSkills() {
    let n = 0;
    for (const s of newSkills) {
      const r = await declareSkill(userId, s.name, '', 'From resume check');
      if (!r.error) n++;
    }
    setAdded(n);
    await onChanged();
  }

  return (
    <>
      <form className="ws-card yg-submit-form" onSubmit={check}>
        <label className="yw-form-label" htmlFor="ai-resume">
          Paste your resume text
        </label>
        <textarea
          id="ai-resume"
          className="yw-form-textarea"
          rows={10}
          maxLength={60000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Copy the text from your PDF or document and paste it here"
        />
        <p className="ws-card-subtitle">Your text is analysed and not stored. Contact details are left out of the result.</p>
        <div className="yg-form-actions">
          <button type="submit" className="ob-btn-primary" disabled={busy || text.trim().length < 40}>
            {busy ? 'Reading…' : 'Check resume'}
          </button>
        </div>
      </form>
      {error && <Problem text={error} />}
      {res && (
        <section className="ws-card yg-stack">
          <div className="yg-talent-head">
            <h3 className="yg-talent-name">Resume score {Math.round(res.analysis.overall_score)}/100</h3>
            <span className="yg-cell-sub">
              {res.analysis.parsed.quantified_bullet_count} of {res.analysis.parsed.bullet_count} bullets have numbers
            </span>
          </div>
          {res.analysis.suggestions.length > 0 && (
            <ul className="yg-mini-list">
              {res.analysis.suggestions.map((s) => (
                <li key={s} className="yg-mini-row">
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <p className="yg-eyebrow">Skills found</p>
            <div className="yg-pill-row">
              {res.analysis.parsed.skills.map((s) => (
                <span
                  key={s.name}
                  className={`yw-skill-pill ${s.support === 'evidenced' ? 'yw-skill-assessed' : 'yw-skill-declared'}`}
                  title={s.support === 'evidenced' ? 'Used in a project or job on your resume' : 'Listed only'}
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          {added > 0 ? (
            <p className="yg-done" role="status">
              Added {added} skill{added === 1 ? '' : 's'} to your passport as Declared.
            </p>
          ) : (
            newSkills.length > 0 && (
              <div className="yg-form-actions" style={{ justifyContent: 'flex-start' }}>
                <button type="button" className="ob-btn-secondary" onClick={addSkills}>
                  Add {newSkills.length} new skill{newSkills.length === 1 ? '' : 's'} to my passport as Declared
                </button>
              </div>
            )
          )}
        </section>
      )}
    </>
  );
}

interface ChatTurn {
  who: 'you' | 'coach';
  text: string;
  reply?: AssistantReply;
}

function AssistantView({ role, onSaved }: { role?: string; onSaved: () => Promise<void> }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [session, setSession] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setTurns((t) => [...t, { who: 'you', text }]);
    setMessage('');
    setBusy(true);
    try {
      const reply = await ai.assistant(text, session, role);
      setSession(reply.session);
      setTurns((t) => [...t, { who: 'coach', text: reply.summary, reply }]);
      setError('');
    } catch (err) {
      setError(errText(err));
    }
    setBusy(false);
  }

  // A confirmed "save_roadmap" is carried out here, by this click, never by the assistant.
  async function decide(actionId: string, kind: string, yes: boolean) {
    try {
      const res = await ai.confirm(session, actionId, yes);
      if (res.session) setSession(res.session as Record<string, unknown>);
      if (yes && kind === 'save_roadmap') {
        const plan = await ai.roadmap(role, 6, 8);
        const saved = await importRoadmapSteps(
          plan.items.map((i) => ({ title: i.title, description: i.objective, type: i.type, weeks: i.start_week ? `weeks ${i.start_week}-${i.end_week}` : undefined })),
        );
        if (saved.error) throw new Error(saved.error);
        await onSaved();
        setNotice('Saved to your Career Roadmap.');
      } else setNotice(yes ? 'Confirmed.' : 'Declined. Nothing was done.');
      setTurns((t) => t.map((x) => (x.reply ? { ...x, reply: { ...x.reply, proposed_actions: x.reply.proposed_actions.filter((p) => p.id !== actionId) } } : x)));
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <section className="ws-card yg-stack">
      <p className="ws-card-subtitle">
        <Bot size={15} aria-hidden="true" /> Ask about your next steps. The assistant suggests; it never applies, books or pays for you.
      </p>
      <div className="yg-chat" aria-live="polite">
        {turns.length === 0 && <p className="yg-muted">Try: “What should I learn next?” or “Which roles fit me, and make me a roadmap.”</p>}
        {turns.map((t, i) => (
          <div key={i} className={`yg-chat-turn is-${t.who}`}>
            <p>{t.text}</p>
            {t.reply?.refused_requests.map((r) => (
              <p key={r.kind} className="yg-cell-sub">
                {r.explanation}
              </p>
            ))}
            {t.reply?.needs_input.map((n) => (
              <p key={n} className="yg-cell-sub">
                Needs: {n}
              </p>
            ))}
            {t.reply?.proposed_actions
              .filter((p) => p.status === 'awaiting_user_confirmation')
              .map((p) => (
                <div key={p.id} className="yg-invite-row">
                  <span className="yg-cell-sub">{p.kind === 'save_roadmap' ? 'Save this roadmap to your Career Roadmap?' : `Confirm: ${p.kind.replace(/_/g, ' ')}?`}</span>
                  <button type="button" className="ob-btn-primary" onClick={() => decide(p.id, p.kind, true)}>
                    Yes
                  </button>
                  <button type="button" className="ob-btn-secondary" onClick={() => decide(p.id, p.kind, false)}>
                    No
                  </button>
                </div>
              ))}
            {t.reply && !t.reply.verification.passed && <p className="yg-cell-sub">This answer failed a self-check; treat it with care.</p>}
          </div>
        ))}
      </div>
      {notice && (
        <p className="yg-done" role="status">
          {notice}
        </p>
      )}
      {error && <Problem text={error} />}
      <form className="yg-invite-row" onSubmit={send}>
        <input
          className="yw-form-input"
          style={{ flex: 1 }}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask the assistant"
          aria-label="Message the assistant"
        />
        <button type="submit" className="ob-btn-primary" disabled={busy || !message.trim()}>
          <Send size={15} aria-hidden="true" />
          <span>{busy ? 'Thinking…' : 'Send'}</span>
        </button>
      </form>
    </section>
  );
}
