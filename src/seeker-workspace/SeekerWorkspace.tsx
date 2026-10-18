import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import type { PassportSkill, SkillReview, TaskRow } from '../lib/database.types';
import type { SubmissionWithTask } from '../lib/seekerData';
import { listMySubmissions, listOpenTasks, listPassport } from '../lib/seekerData';
import { listMyReviewRequests } from '../lib/reviewData';
import { listMyInvitations, type InvitationWithName } from '../lib/talentData';
import { normalise, type SeekerTab } from './shared';
import { SeekerSidebar } from './SeekerSidebar';
import { TaskDetailModal } from './TaskDetailModal';
import { OverviewTab } from './tabs/OverviewTab';
import { PassportTab } from './tabs/PassportTab';
import { TasksTab } from './tabs/TasksTab';
import { SubmissionsTab } from './tabs/SubmissionsTab';
import { InvitationsTab } from './tabs/InvitationsTab';
import { AssessmentsTab } from './tabs/AssessmentsTab';
import { RoadmapTab } from './tabs/RoadmapTab';
import { OpportunitiesTab } from './tabs/OpportunitiesTab';
import { MentorsTab } from './tabs/MentorsTab';
import { AiCoachTab } from './tabs/AiCoachTab';
import '../founder-workspace/workspace.css';

const TITLES: Record<SeekerTab, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'Your Skill Passport, open tasks and submissions at a glance.' },
  passport: { title: 'Skill Passport', sub: 'Declared, Assessed and Verified skills in one profile.' },
  tasks: { title: 'Browse Tasks', sub: 'Real problems posted by founders. Solve one to prove a skill.' },
  submissions: { title: 'My Submissions', sub: 'Track reviews and update work when a revision is requested.' },
  assessments: { title: 'Assessments', sub: 'Short tests scored by Yogyata. Pass one to make a skill Assessed.' },
  opportunities: { title: 'Jobs & Applications', sub: 'Roles recruiters published, your applications and interviews.' },
  mentors: { title: 'Mentors', sub: 'Find a mentor, then follow your sessions, action items and feedback.' },
  roadmap: { title: 'Career Roadmap', sub: 'Milestones from where you are to the role you want.' },
  'ai-coach': { title: 'AI Coach', sub: 'Readiness, a weekly plan, matches, interview practice and a resume check.' },
  invitations: { title: 'Invitations', sub: 'Roles recruiters invited you to, and whether they can find you.' },
};

interface Props {
  userId: string;
  fullName: string;
  headline: string;
  /** From onboarding: the role the seeker is aiming for. */
  primaryRole?: string;
  onSignOut: () => void;
}

interface Data {
  skills: PassportSkill[];
  tasks: TaskRow[];
  submissions: SubmissionWithTask[];
  reviews: SkillReview[];
  invitations: InvitationWithName[];
}

export function SeekerWorkspace({ userId, fullName, headline, primaryRole = '', onSignOut }: Props) {
  const [tab, setTab] = useState<SeekerTab>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);

  const fetchAll = useCallback(
    async (): Promise<Data> => {
      const [skills, tasks, submissions, reviews, invitations] = await Promise.all([
        listPassport(userId),
        listOpenTasks(),
        listMySubmissions(userId),
        listMyReviewRequests(userId),
        listMyInvitations(userId),
      ]);
      return { skills, tasks, submissions, reviews, invitations };
    },
    [userId],
  );

  const reload = useCallback(async () => {
    try {
      setData(await fetchAll());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your workspace.');
    }
  }, [fetchAll]);

  useEffect(() => {
    let live = true;
    fetchAll()
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Could not load your workspace.'));
    return () => {
      live = false;
    };
  }, [fetchAll]);

  const passportNames = useMemo(() => new Set((data?.skills ?? []).map((s) => normalise(s.skill_name))), [data]);
  const byTask = useMemo(() => new Map((data?.submissions ?? []).map((s) => [s.task_id, s])), [data]);

  const go = (next: SeekerTab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const firstName = fullName.split(' ')[0] || 'there';
  const { title, sub } = TITLES[tab];

  return (
    <div className="yw-app ws-root">
      <SeekerSidebar
        currentTab={tab}
        onTabChange={go}
        fullName={fullName}
        headline={headline}
        verifiedCount={data?.skills.filter((s) => s.level === 'verified').length ?? 0}
        openTaskCount={data?.tasks.filter((t) => !byTask.has(t.id)).length ?? 0}
        actionNeededCount={data?.submissions.filter((s) => s.status === 'revision_requested').length ?? 0}
        pendingInvitationCount={data?.invitations.filter((i) => i.status === 'pending').length ?? 0}
        isOpenOnMobile={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onSignOut={onSignOut}
      />

      <div className="yw-main ws-main-wrapper">
        <header className="ws-header" role="banner">
          <div className="ws-header-left">
            <button type="button" className="ws-mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open sidebar navigation">
              <Menu size={20} />
            </button>
            <div className="ws-header-title-wrap">
              <h1 className="ws-header-title">{title}</h1>
              <span className="ws-header-sub">{sub}</span>
            </div>
          </div>
        </header>

        <main id="seeker-main-content">
          {error && (
            <div className="ws-content">
              <p className="yw-alert yw-alert-danger" role="alert">
                {error}{' '}
                <button type="button" className="ob-inline-link-btn" onClick={reload}>
                  Try again
                </button>
              </p>
            </div>
          )}
          {!data && !error && <p className="yg-loading">Loading your workspace…</p>}
          {data && tab === 'overview' && (
            <OverviewTab
              firstName={firstName}
              skills={data.skills}
              tasks={data.tasks}
              submissions={data.submissions}
              passportNames={passportNames}
              onNavigate={go}
              onOpenTask={setOpenTask}
            />
          )}
          {data && tab === 'passport' && <PassportTab userId={userId} skills={data.skills} reviews={data.reviews} onChanged={reload} />}
          {data && tab === 'tasks' && (
            <TasksTab tasks={data.tasks} submissions={data.submissions} passportNames={passportNames} onOpen={setOpenTask} />
          )}
          {data && tab === 'assessments' && <AssessmentsTab userId={userId} onPassed={reload} />}
          {data && tab === 'opportunities' && <OpportunitiesTab userId={userId} passportNames={passportNames} />}
          {data && tab === 'mentors' && (
            <MentorsTab userId={userId} mySkills={data.skills.map((s) => s.skill_name)} careerGoal={primaryRole} />
          )}
          {data && tab === 'roadmap' && <RoadmapTab userId={userId} primaryRole={primaryRole} />}
          {data && tab === 'ai-coach' && <AiCoachTab userId={userId} passportNames={passportNames} onNavigate={go} onChanged={reload} />}
          {data && tab === 'invitations' && (
            <InvitationsTab
              userId={userId}
              invitations={data.invitations}
              hasProvenSkills={data.skills.some((s) => s.level !== 'declared')}
              onChanged={reload}
            />
          )}
          {data && tab === 'submissions' && (
            <SubmissionsTab
              submissions={data.submissions}
              onBrowse={() => go('tasks')}
              onOpen={(s) => {
                // closed or unpublished tasks are not in the open list; rebuild a minimal row so the work stays viewable
                const full = data.tasks.find((t) => t.id === s.task_id);
                if (full) setOpenTask(full);
                else if (s.task) setOpenTask(placeholderTask(s));
              }}
            />
          )}
        </main>
      </div>

      {openTask && (
        <TaskDetailModal
          userId={userId}
          task={openTask}
          submission={byTask.get(openTask.id)}
          passportNames={passportNames}
          onClose={() => setOpenTask(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function placeholderTask(s: SubmissionWithTask): TaskRow {
  return {
    id: s.task_id,
    title: s.task?.title ?? 'Task',
    org_name: s.task?.org_name ?? '',
    status: s.task?.status ?? 'closed',
    client_id: '',
    founder_id: '',
    project_title: '',
    problem_statement: '',
    required_skills: [],
    expected_deliverable: '',
    evaluation_criteria: '',
    deadline: null,
    compensation: 'unspecified',
    reward_details: null,
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}
