import { ArrowRight, BadgeCheck, ClipboardCheck, Lightbulb, Search } from 'lucide-react';
import type { PassportSkill, TaskRow } from '../../lib/database.types';
import type { SubmissionWithTask } from '../../lib/seekerData';
import { LEVEL_LABEL, skillMatch, type SeekerTab } from '../shared';
import { StatusBadge } from '../StatusBadge';
import { UnstopShowcase } from '../UnstopShowcase';

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
    <div className="ws-content sk-overview-stack">
      <div className="ws-card ws-welcome-card">
        <div className="ws-welcome-content">
          <span className="ws-welcome-badge">Seeker Workspace</span>
          <h2 className="ws-welcome-title">Welcome back, {firstName || 'there'} 👋</h2>
          <p className="ws-welcome-desc">
            {next === 'passport'
              ? 'Start by declaring the skills you already have. Tasks that use them will rise to the top.'
              : next === 'tasks'
                ? 'Pick a founder task, solve it, and submit a link. A reviewed submission turns a claim into a Verified skill.'
                : 'Keep an eye on your submissions: reviewers may ask for a revision.'}
          </p>
        </div>
        <div className="ws-welcome-action">
          <button type="button" className="sk-hero-cta" onClick={() => onNavigate(next)}>
            <span>{next === 'passport' ? 'Add skills' : next === 'tasks' ? 'Browse tasks' : 'View submissions'}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="ws-stats-grid">
        {(['verified', 'assessed', 'declared'] as const).map((l) => (
          <button key={l} type="button" className={`ws-stat-card stat-${l}`} onClick={() => onNavigate('passport')}>
            <div className="ws-stat-info">
              <span className="ws-stat-label">{LEVEL_LABEL[l]} skills</span>
              <span className="ws-stat-num">{count(l)}</span>
              <span className="ws-stat-subtext">
                {l === 'verified' ? 'Founder confirmed' : l === 'assessed' ? 'Benchmark tested' : 'Self-declared'} · View →
              </span>
            </div>
            <div className="ws-stat-icon-wrap">
              {l === 'verified' ? <BadgeCheck size={22} /> : l === 'assessed' ? <ClipboardCheck size={22} /> : <Lightbulb size={22} />}
            </div>
          </button>
        ))}
        <button type="button" className="ws-stat-card stat-tasks" onClick={() => onNavigate('tasks')}>
          <div className="ws-stat-info">
            <span className="ws-stat-label">Open tasks</span>
            <span className="ws-stat-num">{tasks.length}</span>
            <span className="ws-stat-subtext">Active founder problems · Browse →</span>
          </div>
          <div className="ws-stat-icon-wrap">
            <Search size={22} />
          </div>
        </button>
      </div>

      <div className="yg-two-col">
        <section className="ws-card">
          <div className="sk-section-header">
            <h3 className="ws-card-title">Suggested tasks</h3>
            <button type="button" className="sk-view-all-btn" onClick={() => onNavigate('tasks')}>
              Browse all <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
          {suggestions.length === 0 ? (
            <p className="ws-card-subtitle">No open tasks right now. New founder problems will appear here.</p>
          ) : (
            <ul className="yg-mini-list">
              {suggestions.map(({ t, m }) => {
                const orgInitials = (t.org_name || 'FT').slice(0, 2).toUpperCase();
                return (
                  <li key={t.id}>
                    <button type="button" className="sk-task-tile" onClick={() => onOpenTask(t)}>
                      <div className="sk-task-tile-left">
                        <div className="sk-task-avatar">{orgInitials}</div>
                        <div className="sk-task-tile-info">
                          <strong className="sk-task-tile-title">{t.title}</strong>
                          <span className="sk-task-tile-meta">
                            <span>{t.org_name || 'Founder task'}</span>
                            {t.required_skills.length > 0 && (
                              <span className="sk-match-tag">
                                {m}/{t.required_skills.length} match
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="sk-task-tile-action">
                        <ArrowRight size={16} aria-hidden="true" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="ws-card">
          <div className="sk-section-header">
            <h3 className="ws-card-title">Recent submissions</h3>
            <button type="button" className="sk-view-all-btn" onClick={() => onNavigate('submissions')}>
              View all <ArrowRight size={13} aria-hidden="true" />
            </button>
          </div>
          {submissions.length === 0 ? (
            <p className="ws-card-subtitle">Nothing submitted yet. Pick a task to start proving skills.</p>
          ) : (
            <ul className="yg-mini-list">
              {submissions.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <div className="sk-submission-tile">
                    <div className="sk-submission-info">
                      <strong className="sk-submission-title">{s.task?.title ?? 'Task no longer available'}</strong>
                      <span className="sk-submission-meta">{s.task?.org_name || 'Founder project'}</span>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Unstop-Style Opportunities: Competitions, Mentors & Recruiter Jobs ── */}
      <UnstopShowcase
        userFullName={firstName}
        userSkills={skills}
        onNavigate={onNavigate}
      />
    </div>
  );
}
