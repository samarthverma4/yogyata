import { useMemo, useState } from 'react';
import { Search, CalendarDays, ArrowRight } from 'lucide-react';
import type { TaskRow } from '../../lib/database.types';
import type { SubmissionWithTask } from '../../lib/seekerData';
import { COMPENSATION_LABEL, formatDate, normalise, skillMatch } from '../shared';
import { StatusBadge } from '../StatusBadge';

interface Props {
  tasks: TaskRow[];
  submissions: SubmissionWithTask[];
  passportNames: Set<string>;
  onOpen: (task: TaskRow) => void;
}

export function TasksTab({ tasks, submissions, passportNames, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [matchOnly, setMatchOnly] = useState(false);
  const byTask = useMemo(() => new Map(submissions.map((s) => [s.task_id, s])), [submissions]);

  const shown = useMemo(() => {
    const q = normalise(query);
    return tasks
      .filter((t) => !matchOnly || skillMatch(t, passportNames) > 0)
      .filter(
        (t) =>
          !q ||
          [t.title, t.org_name, t.project_title, t.problem_statement, ...t.required_skills].some((f) => normalise(f).includes(q)),
      )
      .sort((a, b) => skillMatch(b, passportNames) - skillMatch(a, passportNames));
  }, [tasks, query, matchOnly, passportNames]);

  return (
    <div className="ws-content yg-stack">
      <div className="ws-card yg-filter-bar">
        <div className="yg-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by skill, startup, role or keyword…"
            aria-label="Search tasks"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <label className="sk-filter-pill-toggle">
            <input type="checkbox" checked={matchOnly} onChange={(e) => setMatchOnly(e.target.checked)} />
            <span>Only tasks matching my skills</span>
          </label>
          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748B' }}>
            {shown.length} {shown.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="ws-card ws-empty-state">
          <h4 className="ws-empty-title">{tasks.length === 0 ? 'No open tasks yet' : 'No tasks match your search'}</h4>
          <p className="ws-empty-desc">
            {tasks.length === 0
              ? 'When founders publish problems, they appear here for you to solve and turn into verified proof.'
              : 'Try another keyword, or turn off the skills filter to see all active startup challenges.'}
          </p>
        </div>
      ) : (
        <ul className="yg-task-list">
          {shown.map((t) => {
            const mine = byTask.get(t.id);
            const match = skillMatch(t, passportNames);
            return (
              <li key={t.id}>
                <button type="button" className="yg-task-card" onClick={() => onOpen(t)}>
                  <div>
                    <div className="sk-task-card-head">
                      <span className="sk-task-org-tag">{t.org_name || 'Founder task'}</span>
                      {t.deadline && (
                        <span style={{ fontSize: '0.76rem', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CalendarDays size={13} aria-hidden="true" /> Due {formatDate(t.deadline)}
                        </span>
                      )}
                    </div>
                    <h3 className="yg-task-title">{t.title}</h3>
                    <p className="yg-task-summary">{t.problem_statement}</p>
                    <div className="yg-pill-row">
                      {t.required_skills.slice(0, 5).map((s) => {
                        const isMatch = passportNames.has(normalise(s));
                        return (
                          <span key={s} className={isMatch ? 'sk-skill-chip-match' : 'sk-skill-chip-unmatch'}>
                            {isMatch ? `✓ ${s}` : s}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="yg-task-foot">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="sk-task-reward-chip">{COMPENSATION_LABEL[t.compensation]}</span>
                      {t.required_skills.length > 0 && (
                        <span className="sk-match-tag">
                          {match}/{t.required_skills.length} match
                        </span>
                      )}
                    </div>
                    {mine ? (
                      <StatusBadge status={mine.status} />
                    ) : (
                      <span className="yg-go">
                        Solve task <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
