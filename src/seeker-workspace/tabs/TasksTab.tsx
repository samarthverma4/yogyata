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
            className="yw-form-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by skill, startup or keyword"
            aria-label="Search tasks"
          />
        </div>
        <label className="yg-check">
          <input type="checkbox" checked={matchOnly} onChange={(e) => setMatchOnly(e.target.checked)} />
          <span>Only tasks that use my skills</span>
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="ws-card ws-empty-state">
          <h4 className="ws-empty-title">{tasks.length === 0 ? 'No open tasks yet' : 'No tasks match your search'}</h4>
          <p className="ws-empty-desc">
            {tasks.length === 0
              ? 'When founders publish problems, they appear here for you to solve.'
              : 'Try another keyword, or turn off the skills filter.'}
          </p>
        </div>
      ) : (
        <ul className="yg-task-list">
          {shown.map((t) => {
            const mine = byTask.get(t.id);
            const match = skillMatch(t, passportNames);
            return (
              <li key={t.id}>
                <button type="button" className="ws-card yg-task-card" onClick={() => onOpen(t)}>
                  <span className="yg-eyebrow">{t.org_name || 'Founder task'}</span>
                  <span className="yg-task-title">{t.title}</span>
                  <span className="yg-task-summary">{t.problem_statement}</span>
                  <span className="yg-pill-row">
                    {t.required_skills.slice(0, 5).map((s) => (
                      <span
                        key={s}
                        className={`yw-skill-pill ${passportNames.has(normalise(s)) ? 'yw-skill-verified' : 'yw-skill-declared'}`}
                      >
                        {s}
                      </span>
                    ))}
                  </span>
                  <span className="yg-task-foot">
                    <span>{COMPENSATION_LABEL[t.compensation]}</span>
                    {t.deadline && (
                      <span>
                        <CalendarDays size={14} aria-hidden="true" /> {formatDate(t.deadline)}
                      </span>
                    )}
                    {t.required_skills.length > 0 && (
                      <span>
                        {match} of {t.required_skills.length} skills in your passport
                      </span>
                    )}
                    {mine ? <StatusBadge status={mine.status} /> : <span className="yg-go">View task <ArrowRight size={14} aria-hidden="true" /></span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
