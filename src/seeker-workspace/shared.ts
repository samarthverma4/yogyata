import type { SkillLevel, SubmissionStatus, TaskRow } from '../lib/database.types';

export type SeekerTab =
  | 'overview'
  | 'passport'
  | 'assessments'
  | 'tasks'
  | 'submissions'
  | 'opportunities'
  | 'mentors'
  | 'roadmap'
  | 'invitations';

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  declared: 'Declared',
  assessed: 'Assessed',
  verified: 'Verified',
};

export const LEVEL_HELP: Record<SkillLevel, string> = {
  declared: 'Skills you list yourself, from your resume or onboarding.',
  assessed: 'Skills scored in an assessment or mock interview.',
  verified: 'Skills a reviewer confirmed in work you submitted for a founder task.',
};

/** Seekers may change their work while it waits for review or after a revision request. */
export const canEditSubmission = (status: SubmissionStatus) => status === 'submitted' || status === 'revision_requested';

export const COMPENSATION_LABEL: Record<TaskRow['compensation'], string> = {
  paid: 'Paid challenge',
  unpaid: 'Unpaid challenge',
  unspecified: 'Reward to be discussed',
};

export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const normalise = (s: string) => s.trim().toLowerCase();

/** How many of a task's required skills are already in the seeker's passport. */
export function skillMatch(task: TaskRow, passportNames: Set<string>): number {
  return task.required_skills.filter((s) => passportNames.has(normalise(s))).length;
}
