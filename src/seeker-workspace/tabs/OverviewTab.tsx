import { ArrowRight, BadgeCheck, ClipboardCheck, Lightbulb, Search } from 'lucide-react';
import type { PassportSkill, TaskRow } from '../../lib/database.types';
import type { SubmissionWithTask } from '../../lib/seekerData';
import { LEVEL_LABEL, skillMatch, type SeekerTab } from '../shared';
import { StatusBadge } from '../StatusBadge';

interface Props {
  firstName: string;
  skills: PassportSkill[];
  tasks: TaskRow[];
  submissions: SubmissionWithTask[];
  passportNames: Set<string>;
  onNavigate: (tab: SeekerTab) => void;
  onOpenTask: (task: TaskRow) => void;
}

export function OverviewTab({ firstName, skills, tasks, submissions, passportNames, onNavigate, onOpenTask }: Props) {
  const count = (l: PassportSkill['level']) => skills.filter((s) => s.level === l).length;
  const submittedIds = new Set(submissions.map((s) => s.task_id));
  const suggestions = tasks
    .filter((t) => !submittedIds.has(t.id))
    .map((t) => ({ t, m: skillMatch(t, passportNames) }))
    .sort((a, b) => b.m - a.m)
    .slice(0, 3);
  const next = skills.length === 0 ? 'passport' : submissions.length === 0 ? 'tasks' : 'submissions';

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card ws-welcome-card">
        <p className="yg-eyebrow">Seeker workspace</p>
        <h2 className="ws-welcome-title">Welcome, {firstName}.</h2>
        <p className="ws-welcome-desc">
          {next === 'passport'
            ? 'Start by declaring the skills you already have. Tasks that use them will rise to the top.'
            : next === 'tasks'
              ? 'Pick a founder task, solve it, and submit a link. A reviewed submission turns a claim into a Verified skill.'
              : 'Keep an eye on your submissions: reviewers may ask for a revision.'}
        </p>
        <button type="button" className="ob-btn-primary" onClick={() => onNavigate(next)}>
          <span>{next === 'passport' ? 'Add skills' : next === 'tasks' ? 'Browse tasks' : 'View submissions'}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="ws-stats-grid">
        {(['verified', 'assessed', 'declared'] as const).map((l) => (
          <button key={l} type="button" className="ws-stat-card" onClick={() => onNavigate('passport')}>
            <div>
              <div className="ws-stat-label">{LEVEL_LABEL[l]} skills</div>
              <div className="ws-stat-num">{count(l)}</div>
            </div>
            <div className="ws-stat-icon-wrap icon-blue">
              {l === 'verified' ? <BadgeCheck size={20} /> : l === 'assessed' ? <ClipboardCheck size={20} /> : <Lightbulb size={20} />}
            </div>
          </button>
        ))}
        <button type="button" className="ws-stat-card" onClick={() => onNavigate('tasks')}>
          <div>
            <div className="ws-stat-label">Open tasks</div>
            <div className="ws-stat-num">{tasks.length}</div>
          </div>
          <div className="ws-stat-icon-wrap icon-blue">
            <Search size={20} />
          </div>
        </button>
      </div>

      <div className="yg-two-col">
        <section className="ws-card">
          <div className="ws-card-header">
            <h3 className="ws-card-title">Suggested tasks</h3>
          </div>
          {suggestions.length === 0 ? (
            <p className="ws-card-subtitle">No open tasks right now. New founder problems will appear here.</p>
          ) : (
            <ul className="yg-mini-list">
              {suggestions.map(({ t, m }) => (
                <li key={t.id}>
                  <button type="button" className="yg-mini-item" onClick={() => onOpenTask(t)}>
                    <span>
                      <strong>{t.title}</strong>
                      <span className="yg-cell-sub">
                        {t.org_name}
                        {t.required_skills.length ? ` · ${m} of ${t.required_skills.length} skills match` : ''}
                      </span>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ws-card">
          <div className="ws-card-header">
            <h3 className="ws-card-title">Recent submissions</h3>
          </div>
          {submissions.length === 0 ? (
            <p className="ws-card-subtitle">Nothing submitted yet.</p>
          ) : (
            <ul className="yg-mini-list">
              {submissions.slice(0, 4).map((s) => (
                <li key={s.id} className="yg-mini-row">
                  <span>
                    <strong>{s.task?.title ?? 'Task no longer available'}</strong>
                    <span className="yg-cell-sub">{s.task?.org_name}</span>
                  </span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
