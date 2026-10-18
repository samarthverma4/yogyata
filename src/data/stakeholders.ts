import entrepreneurArt from '../brand/stakeholders/entrepreneur.svg';
import seekerArt from '../brand/stakeholders/seeker.svg';
import mentorArt from '../brand/stakeholders/mentor.svg';
import recruiterArt from '../brand/stakeholders/recruiter.svg';

export type StakeholderId = 'entrepreneur' | 'seeker' | 'mentor' | 'recruiter';

/** The one sign-up field that differs per role. */
export interface RoleField {
  label: string;
  placeholder: string;
  autoComplete: string;
}

export interface Stakeholder {
  id: StakeholderId;
  name: string;
  group: string;
  does: string;
  gets: [string, string, string];
  art: string;
  /** intrinsic width of the artwork, used so every figure renders at the same scale */
  artWidth: number;
  signupField: RoleField;
}

export function findStakeholder(id: string | undefined): Stakeholder | undefined {
  return STAKEHOLDERS.find((s) => s.id === id);
}

// Order follows the project lifecycle: a founder posts, a seeker solves, a mentor reviews, a recruiter invites.
export const STAKEHOLDERS: readonly Stakeholder[] = [
  {
    id: 'entrepreneur',
    name: 'Entrepreneur',
    group: 'Founders & startups',
    does: 'Posts a real problem with a brief, a rubric and a reward.',
    gets: [
      'Trusted contributors who have already shipped work',
      'Paid trial tasks instead of guesswork interviews',
      'An early team, formed around one completed project',
    ],
    art: entrepreneurArt,
    artWidth: 344,
    signupField: { label: 'Startup or project name', placeholder: 'e.g. Kisan Connect', autoComplete: 'organization' },
  },
  {
    id: 'seeker',
    name: 'Seeker',
    group: 'Students & job seekers',
    does: 'Solves founder problems and builds one Skill Passport.',
    gets: [
      'Skills that move from Declared to Assessed to Verified',
      'A readiness score from 0 to 100 and a clear roadmap',
      'Job matches and invites to interview or collaborate',
    ],
    art: seekerArt,
    artWidth: 380,
    signupField: { label: 'College or university', placeholder: 'e.g. IIT Mandi', autoComplete: 'organization' },
  },
  {
    id: 'mentor',
    name: 'Mentor',
    group: 'Industry mentors',
    does: "Reviews submitted work against the founder's rubric.",
    gets: [
      'Serious mentees matched to their weakest skill',
      'Paid 1-on-1 sessions with weekly payouts',
      'A visible record of the talent they helped verify',
    ],
    art: mentorArt,
    artWidth: 442,
    signupField: { label: 'Area of expertise', placeholder: 'e.g. Backend engineering', autoComplete: 'off' },
  },
  {
    id: 'recruiter',
    name: 'Recruiter',
    group: 'Recruiters & colleges',
    does: 'Finds Verified talent and invites them to interview.',
    gets: [
      'Candidates backed by reviewed, linked work',
      'Cohort-level placement readiness for colleges',
      'Fewer blind screens and faster shortlists',
    ],
    art: recruiterArt,
    artWidth: 395,
    signupField: { label: 'Company or college', placeholder: 'e.g. Placement cell, NIT Trichy', autoComplete: 'organization' },
  },
];
